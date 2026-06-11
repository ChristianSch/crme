"use client";

import { DashboardSuggestionGroups } from "@/components/views/dashboard-suggestion-groups";
import { DashboardTaskList } from "@/components/views/dashboard-task-list";
import { Company, Deal, Person, Suggestion, Todo } from "@/lib/api";

export function DashboardPanel({ tasks, suggestions, people, companies, deals, onSelectTask, onSelectPerson, onSelectCompany, onSelectDeal, onOpenTasks, onOpenSuggestions }: { tasks: Todo[]; suggestions: Suggestion[]; people: Person[]; companies: Company[]; deals: Deal[]; onSelectTask: (task: Todo) => void; onSelectPerson?: (person: Person) => void; onSelectCompany?: (company: Company) => void; onSelectDeal?: (deal: Deal) => void; onOpenTasks: () => void; onOpenSuggestions: () => void }) {
  return (
    <div className="bg-[oklch(0.985_0.003_255)]">
      <div className="space-y-4 bg-[oklch(0.985_0.003_255)] p-4">
        <DashboardTaskList
          tasks={tasks}
          people={people}
          companies={companies}
          deals={deals}
          onSelectTask={onSelectTask}
          onSelectPerson={onSelectPerson}
          onSelectCompany={onSelectCompany}
          onSelectDeal={onSelectDeal}
          onOpenTasks={onOpenTasks}
        />
        <DashboardSuggestionGroups suggestions={suggestions} onOpenSuggestions={onOpenSuggestions} />
      </div>
    </div>
  );
}
