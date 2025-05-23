import { Method } from "@/model/interface";
import { BaseService } from "./baseService";
import { supabase } from "../supabaseClient";

export class SupabaseMethodService extends BaseService<Method> {
  protected tableName = "method";

  async getMethodsByCostRange(minCost: number, maxCost: number): Promise<Method[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select("*")
      .gte("cost", minCost)
      .lte("cost", maxCost)
      .order("cost", { ascending: true });

    if (error) {
      throw new Error(`Error fetching methods: ${error.message}`);
    }

    return data || [];
  }
}

export const methodService = new SupabaseMethodService(); 