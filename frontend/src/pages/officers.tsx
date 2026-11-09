import { Edit2, Loader2, Search, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { PageHeader } from "@/components/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMeta, useSaveUser, useUsers } from "@/lib/queries";
import type { Role, User } from "@/lib/types";

export default function OfficersPage() {
  const { data: meta } = useMeta();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useUsers(search ? { search } : {});
  const saveUser = useSaveUser();

  const [editing, setEditing] = useState<Partial<User> & { password?: string } | null>(null);

  function openNew() {
    setEditing({
      username: "",
      first_name: "",
      last_name: "",
      email: "",
      role: "capture_officer",
      province: "",
      employee_number: "",
      phone: "",
      is_active: true,
      password: "",
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      const payload = { ...editing };
      if (!payload.password) delete payload.password;
      await saveUser.mutateAsync(payload);
      toast.success(editing.id ? "Officer account updated." : "Officer account created.");
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration · Head Office"
        title="Ministry Officers"
        description="Manage Head Office officer accounts and workflow roles (Sections A–G)."
        actions={
          <Button onClick={openNew}>
            <UserPlus /> Add officer
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, username, EC number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="grid gap-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officer</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Province</TableHead>
                <TableHead>Last Sign-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.results.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-[11.5px] text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell className="ref">{u.username}</TableCell>
                  <TableCell>{u.role_display}</TableCell>
                  <TableCell>Head Office</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(u.last_login)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "forest" : "earth"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing({ ...u, password: "" })}
                    >
                      <Edit2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Officer Account" : "New Officer Account"}</DialogTitle>
            <DialogDescription>
              Assign the officer's Head Office workflow role for processing Model A2 applications.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSubmit} className="grid gap-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First Name" required>
                  <Input
                    value={editing.first_name || ""}
                    onChange={(e) => setEditing({ ...editing, first_name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Last Name" required>
                  <Input
                    value={editing.last_name || ""}
                    onChange={(e) => setEditing({ ...editing, last_name: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Username" required>
                  <Input
                    value={editing.username || ""}
                    onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Email" required>
                  <Input
                    type="email"
                    value={editing.email || ""}
                    onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <Field label="Workflow Role" required>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v as Role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="EC / Employee Number">
                  <Input
                    value={editing.employee_number || ""}
                    onChange={(e) => setEditing({ ...editing, employee_number: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={editing.phone || ""}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </Field>
              </div>

              <Field
                label={editing.id ? "New Password (leave blank to keep current)" : "Initial Password"}
                required={!editing.id}
              >
                <Input
                  type="password"
                  value={editing.password || ""}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
                  required={!editing.id}
                />
              </Field>

              {editing.id && (
                <label className="flex items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: Boolean(v) })}
                  />
                  <span>Account is active</span>
                </label>
              )}

              <DialogFooter className="mt-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveUser.isPending}>
                  {saveUser.isPending && <Loader2 className="animate-spin" />}
                  Save officer
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

