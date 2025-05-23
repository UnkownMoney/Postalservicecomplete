import { supabase } from "../supabaseClient";
import { Shipment, User, Method } from "@/model/interface";
import { BaseService } from "./baseService";

export class SupabaseShipmentService extends BaseService<Shipment> {
  protected tableName = "shipments";

  async getAll(): Promise<Shipment[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        sender:user!sender(email, address),
        method:method!method(name, cost)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching shipments: ${error.message}`);
    }

    return data || [];
  }

  async getShipmentsByUserId(userId: number): Promise<Shipment[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        sender:user!sender(email, address),
        method:method!method(name, cost)
      `)
      .eq("sender", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching shipments: ${error.message}`);
    }

    return data || [];
  }

  async getShipmentsByStatus(status: string): Promise<Shipment[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        sender:user!sender(email, address),
        method:method!method(name, cost)
      `)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Error fetching shipments: ${error.message}`);
    }

    return data || [];
  }

  async updateShipmentStatus(shipmentId: number, status: string): Promise<Shipment | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update({ status })
      .eq("id", shipmentId)
      .select(`
        *,
        sender:user!sender(email, address),
        method:method!method(name, cost)
      `)
      .single();

    if (error) {
      throw new Error(`Error updating shipment status: ${error.message}`);
    }

    return data;
  }
}

// Create a singleton instance
export const shipmentService = new SupabaseShipmentService(); 