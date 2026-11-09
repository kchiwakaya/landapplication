import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Datum, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";

export default function AccountPage() {
  const { user, setUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  if (!user) return null;

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { data } = await api.patch<User>("/auth/me/", {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      });
      setUser(data);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api.post("/auth/me/password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password changed.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Officer Account"
        title={user.full_name}
        description={`${user.role_display} · Head Office`}
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ministry Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Datum label="Username" mono>
                {user.username}
              </Datum>
              <Datum label="Workflow Role">{user.role_display}</Datum>
              <Datum label="Station">Head Office</Datum>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveProfile} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First Name" required>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Last Name" required>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </Field>
                <Field label="Email Address" required>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Loader2 className="animate-spin" />}
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card id="password">
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onChangePassword} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current Password" required>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </Field>
                <Field label="New Password" required>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword && <Loader2 className="animate-spin" />}
                  Update password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

