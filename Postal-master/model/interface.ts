// Base interfaces
export interface BaseEntity {
  id: number;
  created_at: string; // Assuming timestamptz is represented as a string in TypeScript
}

// Updated interfaces based on schema
export interface User extends BaseEntity {
  address: string;
  priv: boolean; // priv is boolean in the schema
  email: string;
}

export interface Method extends BaseEntity {
  name: string; // 'name' in schema
  cost: number; // 'cost' (float4) in schema
}

export interface Shipment extends BaseEntity {
  status: string; // 'status' (text) in schema
  to_address: string; // 'to_address_id' (text) in schema
  weight: number; // 'weight' (int2) in schema
  method_id: number; // 'method' (int8), likely a foreign key to Method
  sender_id: number; // 'sender' (int8), the foreign key
  sender?: { email: string; address: string }; // Joined sender details
  method?: { name: string; cost: number }; // Joined method details
}

// If you need interfaces representing relationships, you might add something like:
// export interface ShipmentWithDetails extends Shipment {
//   methodDetails: Method;
//   senderDetails: User;
// }