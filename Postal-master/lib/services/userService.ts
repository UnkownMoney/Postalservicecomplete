import { supabase } from "../supabaseClient";
import { User } from "@/model/interface";
import { BaseService } from "./baseService";

export class SupabaseUserService extends BaseService<User> {
  protected tableName = "user";

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("email", email)
      .single();

    if (error) {
      throw new Error(`Error fetching user: ${error.message}`);
    }

    return data;
  }

  async getUsersByPriv(priv: boolean): Promise<User[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("priv", priv)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching users: ${error.message}`);
    }

    return data || [];
  }
}

// Create a singleton instance
export const userService = new SupabaseUserService(); 