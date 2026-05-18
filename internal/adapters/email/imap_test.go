package email

import (
	"net"
	"testing"
)

func TestBlockedIMAPTarget(t *testing.T) {
	tests := []struct {
		name    string
		ip      string
		blocked bool
	}{
		{name: "loopback", ip: "127.0.0.1", blocked: true},
		{name: "private v4", ip: "10.0.0.1", blocked: true},
		{name: "link local", ip: "169.254.169.254", blocked: true},
		{name: "unspecified", ip: "0.0.0.0", blocked: true},
		{name: "public", ip: "8.8.8.8", blocked: false},
		{name: "private v6", ip: "fd00::1", blocked: true},
		{name: "loopback v6", ip: "::1", blocked: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := blockedIMAPTarget(net.ParseIP(tt.ip)); got != tt.blocked {
				t.Fatalf("blockedIMAPTarget(%s) = %v, want %v", tt.ip, got, tt.blocked)
			}
		})
	}
}
