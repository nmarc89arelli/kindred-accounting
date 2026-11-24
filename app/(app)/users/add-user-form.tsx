"use client";

import { useRef, useState, useTransition } from "react";
import { addUser } from "./actions";

export function AddUserForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addUser(formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <>
      <form ref={formRef} action={onSubmit} className="formrow">
        <input
          type="email"
          name="email"
          placeholder="boardmember@gmail.com"
          aria-label="Email address to allow"
          required
        />
        <select name="role" aria-label="Role" defaultValue="board">
          <option value="board">Board</option>
          <option value="exec">Exec</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add user"}
        </button>
      </form>
      {error && (
        <p className="notice error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
    </>
  );
}
