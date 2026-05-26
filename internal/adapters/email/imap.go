package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"strings"
	"time"

	imap "github.com/emersion/go-imap"
	"github.com/emersion/go-imap/client"
	messageMail "github.com/emersion/go-message/mail"

	"crme/internal/domain"
)

type IMAPClient struct {
	AllowPrivateHosts bool
}

func (f IMAPClient) TestEmailAccount(ctx context.Context, account domain.EmailAccount, secret string) error {
	c, err := f.connect(ctx, account, secret)
	if err != nil {
		return err
	}
	defer c.Logout()
	_, err = c.Select("INBOX", true)
	return err
}

func (f IMAPClient) ListMailFolders(ctx context.Context, account domain.EmailAccount, secret string) ([]string, error) {
	c, err := f.connect(ctx, account, secret)
	if err != nil {
		return nil, err
	}
	defer c.Logout()
	mailboxes := make(chan *imap.MailboxInfo, 32)
	done := make(chan error, 1)
	go func() { done <- c.List("", "*", mailboxes) }()
	var out []string
	for mailbox := range mailboxes {
		if mailbox != nil {
			out = append(out, mailbox.Name)
		}
	}
	return out, <-done
}

func (f IMAPClient) FetchNewMessages(ctx context.Context, account domain.EmailAccount, secret string, folder string, since time.Time, limit int) ([]domain.EmailMessage, error) {
	c, err := f.connect(ctx, account, secret)
	if err != nil {
		return nil, err
	}
	defer c.Logout()
	if strings.TrimSpace(folder) == "" {
		folder = "INBOX"
	}
	_, err = c.Select(folder, true)
	if err != nil {
		return nil, err
	}
	criteria := imap.NewSearchCriteria()
	if !since.IsZero() {
		criteria.Since = since.Add(-24 * time.Hour)
	}
	uids, err := c.UidSearch(criteria)
	if err != nil {
		return nil, err
	}
	if len(uids) == 0 {
		return nil, nil
	}
	if limit <= 0 {
		limit = 50
	}
	if len(uids) > limit {
		uids = uids[len(uids)-limit:]
	}
	seqset := new(imap.SeqSet)
	seqset.AddNum(uids...)
	section := &imap.BodySectionName{}
	items := []imap.FetchItem{imap.FetchEnvelope, imap.FetchUid, section.FetchItem()}
	ch := make(chan *imap.Message, len(uids))
	done := make(chan error, 1)
	go func() { done <- c.UidFetch(seqset, items, ch) }()
	var out []domain.EmailMessage
	for msg := range ch {
		select {
		case <-ctx.Done():
			return out, ctx.Err()
		default:
		}
		if msg == nil || msg.Envelope == nil {
			continue
		}
		body := ""
		if r := msg.GetBody(section); r != nil {
			body = readPlainText(r)
		}
		fromEmail := firstAddress(msg.Envelope.From)
		direction := "inbound"
		if strings.EqualFold(fromEmail, account.Email) {
			direction = "outbound"
		}
		m := domain.EmailMessage{
			EmailAccountID: account.ID,
			MessageID:      strings.TrimSpace(msg.Envelope.MessageId),
			ThreadKey:      threadKey(msg.Envelope),
			Direction:      direction,
			FromEmail:      fromEmail,
			FromName:       firstAddressName(msg.Envelope.From),
			ToEmails:       addresses(msg.Envelope.To),
			Subject:        msg.Envelope.Subject,
			BodyText:       body,
			SentAt:         msg.Envelope.Date,
		}
		if m.MessageID == "" {
			m.MessageID = fmt.Sprintf("imap:%s:%d", account.ID, msg.Uid)
		}
		if m.ThreadKey == "" {
			m.ThreadKey = m.MessageID
		}
		if m.SentAt.IsZero() {
			m.SentAt = time.Now().UTC()
		}
		out = append(out, m)
	}
	if err := <-done; err != nil {
		return out, err
	}
	return out, nil
}

type guardedDialer struct {
	AllowPrivateHosts bool
	Dialer            net.Dialer
}

func (d guardedDialer) Dial(network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return nil, err
	}
	for _, ip := range ips {
		if !d.AllowPrivateHosts && blockedIMAPTarget(ip) {
			return nil, fmt.Errorf("IMAP host %s resolves to blocked address %s", host, ip)
		}
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("IMAP host %s did not resolve", host)
	}
	return d.Dialer.Dial(network, net.JoinHostPort(ips[0].String(), port))
}

func (f IMAPClient) connect(ctx context.Context, account domain.EmailAccount, secret string) (*client.Client, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if account.IMAPHost == "" {
		return nil, fmt.Errorf("email account %s has no IMAP host", account.Email)
	}
	if account.IMAPPort == 0 {
		account.IMAPPort = 993
	}
	if account.IMAPUsername == "" {
		account.IMAPUsername = account.Email
	}
	addr := fmt.Sprintf("%s:%d", account.IMAPHost, account.IMAPPort)
	c, err := client.DialWithDialerTLS(guardedDialer{AllowPrivateHosts: f.AllowPrivateHosts, Dialer: net.Dialer{Timeout: 15 * time.Second}}, addr, &tls.Config{ServerName: account.IMAPHost, MinVersion: tls.VersionTLS12})
	if err != nil {
		return nil, err
	}
	if err := c.Login(account.IMAPUsername, secret); err != nil {
		_ = c.Logout()
		return nil, err
	}
	return c, nil
}

func blockedIMAPTarget(ip net.IP) bool {
	return ip.IsUnspecified() || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast()
}

func readPlainText(r io.Reader) string {
	mr, err := messageMail.CreateReader(r)
	if err != nil {
		b, _ := io.ReadAll(io.LimitReader(r, 200_000))
		return string(b)
	}
	for {
		p, err := mr.NextPart()
		if err != nil {
			break
		}
		switch h := p.Header.(type) {
		case *messageMail.InlineHeader:
			ct, _, _ := h.ContentType()
			if strings.HasPrefix(strings.ToLower(ct), "text/plain") {
				b, _ := io.ReadAll(io.LimitReader(p.Body, 200_000))
				return string(b)
			}
		}
	}
	return ""
}

func firstAddress(addrs []*imap.Address) string {
	if len(addrs) == 0 || addrs[0] == nil {
		return ""
	}
	return strings.ToLower(addrs[0].MailboxName + "@" + addrs[0].HostName)
}

func firstAddressName(addrs []*imap.Address) string {
	if len(addrs) == 0 || addrs[0] == nil {
		return ""
	}
	return strings.TrimSpace(addrs[0].PersonalName)
}

func addresses(addrs []*imap.Address) []string {
	out := make([]string, 0, len(addrs))
	for _, a := range addrs {
		if a == nil {
			continue
		}
		out = append(out, strings.ToLower(a.MailboxName+"@"+a.HostName))
	}
	return out
}

func threadKey(e *imap.Envelope) string {
	if e == nil {
		return ""
	}
	if len(e.InReplyTo) > 0 {
		return strings.TrimSpace(e.InReplyTo)
	}
	return strings.TrimSpace(e.MessageId)
}
