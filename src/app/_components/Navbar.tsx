import { auth } from "~/server/auth";
import NavbarWithDrawer from "./NavbarWithDrawer";

export default async function Navbar() {
  const session = await auth();
  return <NavbarWithDrawer session={session} />;
} 