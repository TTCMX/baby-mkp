import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-2xl font-extrabold">Tu cuenta está suspendida</h1>
      <p className="mt-2 text-muted-foreground">Si crees que es un error, escríbenos y lo revisamos.</p>
      <form action={signOut} className="mt-6">
        <Button variant="outline" type="submit">
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
