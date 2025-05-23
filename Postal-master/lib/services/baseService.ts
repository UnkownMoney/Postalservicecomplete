import { supabase } from "../supabaseClient";
import { BaseEntity } from "@/model/interface";

export abstract class BaseService<T extends BaseEntity> {
  protected abstract tableName: string;

  async getAll(): Promise<T[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching ${this.tableName}: ${error.message}`);
    }

    return data || [];
  }

  async getById(id: number): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(`Error fetching ${this.tableName}: ${error.message}`);
    }

    return data;
  }

  async create(item: Omit<T, "id" | "created_at">): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert([item])
      .select()
      .single();

    if (error) {
      throw new Error(`Error creating ${this.tableName}: ${error.message}`);
    }

    return data;
  }

  async update(id: number, item: Partial<T>): Promise<T | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(item)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Error updating ${this.tableName}: ${error.message}`);
    }

    return data;
  }

  async delete(id: number): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Error deleting ${this.tableName}: ${error.message}`);
    }
  }
} 