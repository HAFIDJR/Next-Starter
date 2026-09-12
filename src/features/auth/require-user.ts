import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser } from "./session";
import type { AuthenticatedUser } from "./type";

export async function requireCurrentUser () :Promise<AuthenticatedUser>{

    const user = await getCurrentUser();

    if(!user){
        redirect("/login")
    }

    return user;
    
}
