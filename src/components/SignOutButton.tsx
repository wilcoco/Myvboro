import { signOut } from "@/auth";

export default function SignOutButton({ label }: { label: string }) {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button
        type="submit"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {label}
      </button>
    </form>
  );
}
