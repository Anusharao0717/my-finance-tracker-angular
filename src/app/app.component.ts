import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { environment } from "../environments/environment";

type Category =
  | "Loans"
  | "Driver Payments"
  | "Credit Cards"
  | "Gold Loans"
  | "Maintenance"
  | "Insurance"
  | "Household"
  | "Other";
interface Payment {
  id: string;
  name: string;
  category: Category;
  amount: number;
  dueDay: number | null;
  paid: boolean;
  paidDate?: string;
  note?: string;
}
interface Credit {
  id: string;
  name: string;
  amount: number;
  received: boolean;
  date?: string;
  note?: string;
}
interface MonthData {
  income: number;
  incomeReceived: boolean;
  credits: Credit[];
  payments: Payment[];
  budget?: number;
  savingsGoal?: number;
}
type Recurrence = "None" | "Daily" | "Weekly" | "Monthly";
interface TodoTask {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  dueAt: string;
  completed: boolean;
  reminder: boolean;
  notified?: boolean;
  completedAt?: string;
  recurrence?: Recurrence;
  tags?: string[];
  subtasks?: { id: string; title: string; completed: boolean }[];
  history?: { action: string; at: string }[];
  assignedTo?: string;
}

interface AppData {
  months: Record<string, MonthData>;
  darkMode: boolean;
  tasks: TodoTask[];
}
@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit, OnDestroy {
  readonly categories: Category[] = [
    "Loans",
    "Driver Payments",
    "Credit Cards",
    "Gold Loans",
    "Maintenance",
    "Insurance",
    "Household",
    "Other",
  ];
  data: AppData = { months: {}, darkMode: true, tasks: [] };
  selectedDate = new Date();
  user: User | null = null;
  authMode: "login" | "signup" = "login";
  email = "";
  password = "";
  authMessage = "";
  busy = false;
  status = "Local mode";
  showPaymentForm = false;
  showCreditForm = false;
  editingPaymentId: string | null = null;
  editingCreditId: string | null = null;
  paymentForm: Payment = this.blankPayment();
  creditForm: Credit = this.blankCredit();
  tasksView: "all" | "today" | "pending" | "completed" | "overdue" = "today";
  taskLayout: "list" | "board" | "calendar" = "list";
  taskSearch = "";
  taskCategoryFilter = "All";
  taskTagsText = "";
  taskSubtasksText = "";
  showTaskForm = false;
  editingTaskId: string | null = null;
  taskForm: TodoTask = this.blankTask();
  notificationMessage = "";
  private reminderTimer: any;
  private client: SupabaseClient | null = null;
  private saveTimer: any;
  private authSub: any;
  constructor() {
    if (environment.supabaseUrl && environment.supabaseAnonKey) {
      this.client = createClient(
        environment.supabaseUrl,
        environment.supabaseAnonKey,
        { auth: { persistSession: true, autoRefreshToken: true } },
      );
    }
  }
  ngOnInit() {
    this.reminderTimer = setInterval(() => this.checkTaskReminders(), 30000);
    if (this.client) {
      this.data = this.blankData();
      this.ensureMonth();
      this.status = "Sign in to load your personal data";
      this.client.auth.getUser().then(({ data }) => {
        this.user = data.user;
        if (this.user) void this.loadCloud();
      });
      const { data } = this.client.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user ?? null;
        this.user = nextUser;
        if (nextUser) void this.loadCloud();
        else {
          this.data = this.blankData();
          this.ensureMonth();
          this.status = "Signed out";
        }
      });
      this.authSub = data.subscription;
    } else {
      this.data = this.loadLocal();
      this.ensureMonth();
    }
  }
  ngOnDestroy() {
    clearInterval(this.reminderTimer);
    clearTimeout(this.saveTimer);
    this.authSub?.unsubscribe();
  }
  get monthKey() {
    return `${this.selectedDate.getFullYear()}-${String(this.selectedDate.getMonth() + 1).padStart(2, "0")}`;
  }
  get monthLabel() {
    return this.selectedDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  }
  get month(): MonthData {
    return this.data.months[this.monthKey];
  }
  get bills() {
    return this.month.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  get paidTotal() {
    return this.month.payments
      .filter((p) => p.paid)
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  get pendingTotal() {
    return this.bills - this.paidTotal;
  }
  get incomeTotal() {
    return (
      Number(this.month.income || 0) +
      this.month.credits
        .filter((c) => c.received)
        .reduce((s, c) => s + Number(c.amount || 0), 0)
    );
  }
  get moneyLeft() {
    return this.incomeTotal - this.paidTotal;
  }
  get progress() {
    return this.bills ? Math.round((this.paidTotal / this.bills) * 100) : 0;
  }
  get groupedCategories() {
    return this.categories
      .map((category) => ({
        category,
        items: this.month.payments.filter((p) => p.category === category),
      }))
      .filter((g) => g.items.length);
  }
  get upcoming() {
    return this.month.payments
      .filter((p) => !p.paid && p.dueDay !== null)
      .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))
      .slice(0, 4);
  }
  previousMonth() {
    this.selectedDate = new Date(
      this.selectedDate.getFullYear(),
      this.selectedDate.getMonth() - 1,
      1,
    );
    this.ensureMonth();
  }
  nextMonth() {
    this.selectedDate = new Date(
      this.selectedDate.getFullYear(),
      this.selectedDate.getMonth() + 1,
      1,
    );
    this.ensureMonth();
  }
  private blankPayment(): Payment {
    return {
      id: "",
      name: "",
      category: "Other",
      amount: 0,
      dueDay: null,
      paid: false,
      note: "",
    };
  }
  private blankCredit(): Credit {
    return {
      id: "",
      name: "",
      amount: 0,
      received: false,
      date: new Date().toISOString().slice(0, 10),
      note: "",
    };
  }
  private blankData(): AppData {
    return { months: {}, darkMode: true, tasks: [] };
  }
  private blankTask(): TodoTask {
    const due = new Date(Date.now() + 60 * 60 * 1000);
    due.setSeconds(0, 0);
    return {
      id: "",
      title: "",
      description: "",
      category: "Personal",
      priority: "Medium",
      dueAt: this.toLocalDateTime(due),
      completed: false,
      reminder: true,
      recurrence: "None",
      tags: [],
      subtasks: [],
      history: [],
    };
  }
  private toLocalDateTime(d: Date) {
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
  }
  private defaultMonth(): MonthData {
    return {
      income: 0,
      incomeReceived: false,
      credits: [],
      payments: [],
      budget: 0,
      savingsGoal: 0,
    };
  }
  private makePayment(
    name: string,
    category: Category,
    amount: number,
    dueDay: number | null,
  ): Payment {
    return {
      id: crypto.randomUUID(),
      name,
      category,
      amount,
      dueDay,
      paid: false,
    };
  }
  private ensureMonth() {
    if (!this.data.months[this.monthKey]) {
      const prev = new Date(
        this.selectedDate.getFullYear(),
        this.selectedDate.getMonth() - 1,
        1,
      );
      const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      const old = this.data.months[prevKey];
      this.data.months[this.monthKey] = old
        ? {
            income: old.income,
            incomeReceived: false,
            credits: [],
            payments: old.payments.map((p) => ({
              ...p,
              id: crypto.randomUUID(),
              paid: false,
              paidDate: undefined,
            })),
          }
        : this.defaultMonth();
      this.persist();
    }
  }
  private loadLocal(): AppData {
    try {
      const raw = localStorage.getItem("my-finance-angular-v1");
      if (!raw) return this.blankData();
      const parsed = JSON.parse(raw) as AppData;
      return {
        ...parsed,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      };
    } catch {
      return this.blankData();
    }
  }
  private persist() {
    if (!Array.isArray(this.data.tasks)) this.data.tasks = [];
    localStorage.setItem("my-finance-angular-v1", JSON.stringify(this.data));
    clearTimeout(this.saveTimer);
    if (this.user && this.client) {
      this.status = "Saving…";
      this.saveTimer = setTimeout(() => void this.saveCloud(), 700);
    } else this.status = "Saved on this device";
  }
  private async loadCloud() {
    if (!this.client || !this.user) return;
    const loadingUserId = this.user.id;
    this.status = "Loading your data…";
    const { data, error } = await this.client
      .from("user_finance_data")
      .select("app_data")
      .eq("user_id", loadingUserId)
      .maybeSingle();
    if (error) {
      this.status = "Cloud error";
      console.error(error);
      return;
    }
    if (!this.user || this.user.id !== loadingUserId) return;
    if (data?.app_data && typeof data.app_data === "object") {
      const saved = data.app_data as Partial<AppData>;
      this.data = {
        months:
          saved.months && typeof saved.months === "object" ? saved.months : {},
        darkMode: typeof saved.darkMode === "boolean" ? saved.darkMode : true,
        tasks: Array.isArray(saved.tasks)
          ? saved.tasks.filter(
              (t: any) =>
                t &&
                typeof t.title === "string" &&
                typeof t.id === "string" &&
                typeof t.dueAt === "string",
            )
          : [],
      };
    } else {
      this.data = this.blankData();
    }
    this.ensureMonth();
    this.saveLocalOnly();
    await this.saveCloud();
    this.status = "Cloud synced";
  }
  private async saveCloud() {
    if (!this.client || !this.user) return;
    const { error } = await this.client
      .from("user_finance_data")
      .upsert(
        {
          user_id: this.user.id,
          app_data: this.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    this.status = error ? "Sync failed" : "Cloud synced";
    if (error) console.error(error);
  }
  private saveLocalOnly() {
    localStorage.setItem("my-finance-angular-v1", JSON.stringify(this.data));
  }
  async authenticate() {
    if (!this.client) {
      this.authMessage =
        "Add your Supabase URL and publishable key in src/environments/environment.ts first.";
      return;
    }
    if (!this.email || !this.password) {
      this.authMessage = "Enter your email and password.";
      return;
    }
    this.busy = true;
    this.authMessage = "";
    const result =
      this.authMode === "signup"
        ? await this.client.auth.signUp({
            email: this.email,
            password: this.password,
          })
        : await this.client.auth.signInWithPassword({
            email: this.email,
            password: this.password,
          });
    this.busy = false;
    this.authMessage =
      result.error?.message ??
      (this.authMode === "signup"
        ? "Account created. Check your email if confirmation is enabled."
        : "Signed in.");
    if (result.data.user) {
      this.user = result.data.user;
      await this.loadCloud();
    }
  }
  async signOut() {
    await this.client?.auth.signOut();
    this.user = null;
    this.data = this.blankData();
    this.ensureMonth();
    this.status = "Signed out";
  }
  togglePaid(p: Payment) {
    p.paid = !p.paid;
    p.paidDate = p.paid ? new Date().toISOString().slice(0, 10) : undefined;
    this.persist();
  }
  setIncome(value: string) {
    this.month.income = Math.max(0, Number(value) || 0);
    this.persist();
  }
  setIncomeReceived(value: boolean) {
    this.month.incomeReceived = value;
    this.persist();
  }
  openAddPayment() {
    this.editingPaymentId = null;
    this.paymentForm = this.blankPayment();
    this.showPaymentForm = true;
  }
  editPayment(p: Payment) {
    this.editingPaymentId = p.id;
    this.paymentForm = { ...p };
    this.showPaymentForm = true;
  }
  savePayment() {
    if (!this.paymentForm.name.trim() || this.paymentForm.amount < 0) return;
    const p = {
      ...this.paymentForm,
      id: this.editingPaymentId ?? crypto.randomUUID(),
    };
    if (this.editingPaymentId) {
      const i = this.month.payments.findIndex(
        (x) => x.id === this.editingPaymentId,
      );
      if (i >= 0) this.month.payments[i] = p;
    } else this.month.payments.push(p);
    this.showPaymentForm = false;
    this.persist();
  }
  deletePayment(p: Payment) {
    if (confirm(`Delete "${p.name}"?`)) {
      this.month.payments = this.month.payments.filter((x) => x.id !== p.id);
      this.persist();
    }
  }
  openAddCredit() {
    this.editingCreditId = null;
    this.creditForm = this.blankCredit();
    this.showCreditForm = true;
  }
  editCredit(c: Credit) {
    this.editingCreditId = c.id;
    this.creditForm = { ...c };
    this.showCreditForm = true;
  }
  saveCredit() {
    if (!this.creditForm.name.trim() || this.creditForm.amount < 0) return;
    const c = {
      ...this.creditForm,
      id: this.editingCreditId ?? crypto.randomUUID(),
    };
    if (this.editingCreditId) {
      const i = this.month.credits.findIndex(
        (x) => x.id === this.editingCreditId,
      );
      if (i >= 0) this.month.credits[i] = c;
    } else this.month.credits.push(c);
    this.showCreditForm = false;
    this.persist();
  }
  toggleCredit(c: Credit) {
    c.received = !c.received;
    c.date = c.received ? new Date().toISOString().slice(0, 10) : undefined;
    this.persist();
  }
  deleteCredit(c: Credit) {
    if (confirm(`Delete "${c.name}"?`)) {
      this.month.credits = this.month.credits.filter((x) => x.id !== c.id);
      this.persist();
    }
  }
  private localDateKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  get visibleTasks() {
    const tasks = this.data.tasks ?? [];
    const today = this.localDateKey(new Date());
    const q = this.taskSearch.trim().toLowerCase();
    return tasks
      .filter((t) => {
        const matchView =
          this.tasksView === "all" ||
          (this.tasksView === "completed"
            ? t.completed
            : this.tasksView === "pending"
              ? !t.completed
              : this.tasksView === "overdue"
                ? this.isOverdue(t)
                : !t.completed && t.dueAt.slice(0, 10) === today);
        const haystack = [
          t.title,
          t.description ?? "",
          t.category,
          ...(t.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return (
          matchView &&
          (this.taskCategoryFilter === "All" ||
            t.category === this.taskCategoryFilter) &&
          (!q || haystack.includes(q))
        );
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const rank = { High: 0, Medium: 1, Low: 2 };
        return (
          rank[a.priority] - rank[b.priority] || a.dueAt.localeCompare(b.dueAt)
        );
      });
  }
  get todayKey() {
    return this.localDateKey(new Date());
  }
  get todayTasksCount() {
    return (this.data.tasks ?? []).filter(
      (t) => !t.completed && t.dueAt.slice(0, 10) === this.todayKey,
    ).length;
  }
  isOverdue(t: TodoTask) {
    return (
      !t.completed && !!t.dueAt && new Date(t.dueAt).getTime() < Date.now()
    );
  }
  get tasksDone() {
    return (this.data.tasks ?? []).filter((t) => t.completed).length;
  }
  get tasksPending() {
    return (this.data.tasks ?? []).filter((t) => !t.completed).length;
  }
  get tasksOverdue() {
    return (this.data.tasks ?? []).filter((t) => this.isOverdue(t)).length;
  }
  get taskCompletionRate() {
    const total = (this.data.tasks ?? []).length;
    return total ? Math.round((this.tasksDone / total) * 100) : 0;
  }
  get budgetRemaining() {
    return Math.max(0, Number(this.month.budget || 0) - this.paidTotal);
  }
  get budgetPercent() {
    return this.month.budget
      ? Math.min(100, Math.round((this.paidTotal / this.month.budget) * 100))
      : 0;
  }
  setBudget(value: string) {
    this.month.budget = Math.max(0, Number(value) || 0);
    this.persist();
  }
  setSavingsGoal(value: string) {
    this.month.savingsGoal = Math.max(0, Number(value) || 0);
    this.persist();
  }
  exportTasksCsv() {
    const rows = [
      [
        "Title",
        "Description",
        "Category",
        "Priority",
        "Due",
        "Completed",
        "Recurrence",
        "Tags",
      ],
      ...(this.data.tasks ?? []).map((t) => [
        t.title,
        t.description ?? "",
        t.category,
        t.priority,
        t.dueAt,
        t.completed ? "Yes" : "No",
        t.recurrence ?? "None",
        (t.tags ?? []).join(";"),
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  exportFinanceCsv() {
    const rows = [
      ["Type", "Name", "Amount", "Status", "Due/Date"],
      ...this.month.payments.map((p) => [
        "Payment",
        p.name,
        p.amount,
        p.paid ? "Paid" : "Pending",
        p.dueDay ?? "",
      ]),
      ...this.month.credits.map((c) => [
        "Income",
        c.name,
        c.amount,
        c.received ? "Received" : "Pending",
        c.date ?? "",
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-${this.monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  openAddTask() {
    this.editingTaskId = null;
    this.taskForm = this.blankTask();
    this.taskTagsText = "";
    this.taskSubtasksText = "";
    this.showTaskForm = true;
  }
  editTask(t: TodoTask) {
    this.editingTaskId = t.id;
    this.taskForm = {
      ...t,
      tags: [...(t.tags ?? [])],
      subtasks: [...(t.subtasks ?? [])],
      history: [...(t.history ?? [])],
    };
    this.taskTagsText = (t.tags ?? []).join(", ");
    this.taskSubtasksText = (t.subtasks ?? []).map((x) => x.title).join("\n");
    this.showTaskForm = true;
  }
  saveTask() {
    if (
      !this.taskForm.title.trim() ||
      !this.taskForm.dueAt ||
      !Number.isFinite(new Date(this.taskForm.dueAt).getTime())
    )
      return;
    const existing = this.editingTaskId
      ? this.data.tasks.find((t) => t.id === this.editingTaskId)
      : undefined;
    const tags = this.taskTagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const subtaskTitles = this.taskSubtasksText
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    const oldSubtasks = existing?.subtasks ?? [];
    const task: TodoTask = {
      ...this.taskForm,
      title: this.taskForm.title.trim(),
      id: this.editingTaskId ?? crypto.randomUUID(),
      tags: [...new Set(tags)],
      subtasks: subtaskTitles.map(
        (title) =>
          oldSubtasks.find((x) => x.title === title) ?? {
            id: crypto.randomUUID(),
            title,
            completed: false,
          },
      ),
      history: [
        ...(existing?.history ?? []),
        {
          action: existing ? "Updated" : "Created",
          at: new Date().toISOString(),
        },
      ],
      notified:
        existing && this.taskForm.dueAt === existing.dueAt
          ? this.taskForm.notified
          : false,
    };
    if (this.editingTaskId) {
      const i = this.data.tasks.findIndex((t) => t.id === this.editingTaskId);
      if (i >= 0) this.data.tasks[i] = task;
    } else this.data.tasks.unshift(task);
    this.showTaskForm = false;
    this.persist();
  }
  toggleTask(t: TodoTask) {
    t.completed = !t.completed;
    t.completedAt = t.completed ? new Date().toISOString() : undefined;
    t.history = [
      ...(t.history ?? []),
      {
        action: t.completed ? "Completed" : "Reopened",
        at: new Date().toISOString(),
      },
    ];
    this.persist();
    if (t.completed && t.recurrence && t.recurrence !== "None")
      this.createNextRecurringTask(t);
  }
  private createNextRecurringTask(task: TodoTask) {
    const due = new Date(task.dueAt);
    if (task.recurrence === "Daily") due.setDate(due.getDate() + 1);
    else if (task.recurrence === "Weekly") due.setDate(due.getDate() + 7);
    else if (task.recurrence === "Monthly") due.setMonth(due.getMonth() + 1);
    const next: TodoTask = {
      ...task,
      id: crypto.randomUUID(),
      dueAt: this.toLocalDateTime(due),
      completed: false,
      completedAt: undefined,
      notified: false,
      history: [
        { action: "Created from recurring task", at: new Date().toISOString() },
      ],
      subtasks: (task.subtasks ?? []).map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        completed: false,
      })),
    };
    this.data.tasks.unshift(next);
    this.persist();
  }
  deleteTask(t: TodoTask) {
    if (confirm(`Delete task "${t.title}"?`)) {
      this.data.tasks = this.data.tasks.filter((x) => x.id !== t.id);
      this.persist();
    }
  }
  async enableTaskNotifications() {
    if (!("Notification" in window)) {
      this.notificationMessage = "This browser does not support notifications.";
      return;
    }
    const permission = await Notification.requestPermission();
    this.notificationMessage =
      permission === "granted"
        ? "Notifications enabled. Keep this app open for due-time reminders."
        : "Notifications were not enabled. Allow them in your browser settings.";
    if (permission === "granted") this.checkTaskReminders();
  }
  private checkTaskReminders() {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const now = Date.now();
    for (const task of this.data.tasks ?? []) {
      if (task.completed || !task.reminder || task.notified || !task.dueAt)
        continue;
      const due = new Date(task.dueAt).getTime();
      if (
        Number.isFinite(due) &&
        due <= now &&
        due > now - 24 * 60 * 60 * 1000
      ) {
        try {
          new Notification("Task reminder", {
            body: `${task.title}${task.priority === "High" ? " · High priority" : ""}`,
          });
          task.notified = true;
          this.persist();
        } catch (error) {
          console.error("Unable to show task notification", error);
        }
      }
    }
  }
  categoryTotal(items: Payment[]) {
    return items.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }
  ordinal(day: number) {
    const n = day % 100;
    return n >= 11 && n <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";
  }
  toggleTheme() {
    this.data.darkMode = !this.data.darkMode;
    this.persist();
  }
}
