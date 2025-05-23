"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Shipment, User, Method } from "@/model/interface";
import { userService } from "@/lib/services/userService";
import { shipmentService } from "@/lib/services/packageService";
import { methodService } from "@/lib/services/methodTypeService";

export default function UserDashboard() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackingId, setTrackingId] = useState("");
  const [shippingMethods, setShippingMethods] = useState<Method[]>([]);
  const [activeTab, setActiveTab] = useState("active"); // active, history, canceled
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [shipmentToCancel, setShipmentToCancel] = useState<Shipment | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [newShipment, setNewShipment] = useState({
    to_address: "",
    weight: 0,
    method: 1
  });
  const router = useRouter();

  const statusMap = {
    "pending": { label: "Pending", style: "bg-yellow-100 text-yellow-800" },
    "picked_up": { label: "Picked Up", style: "bg-blue-100 text-blue-800" },
    "in_transit": { label: "In Transit", style: "bg-purple-100 text-purple-800" },
    "out_for_delivery": { label: "Out for Delivery", style: "bg-indigo-100 text-indigo-800" },
    "delivered": { label: "Delivered", style: "bg-green-100 text-green-800" },
    "failed_delivery": { label: "Failed Delivery", style: "bg-orange-100 text-orange-800" },
    "returned": { label: "Returned", style: "bg-red-100 text-red-800" },
    "cancelled": { label: "Cancelled", style: "bg-gray-100 text-gray-800" }
  };

  useEffect(() => {
    checkUser();
    fetchShippingMethods();
    subscribeToShipmentUpdates();
  }, []);

  const subscribeToShipmentUpdates = () => {
    if (!user) return;

    const subscription = supabase
      .channel('shipment_updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'shipments',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        const updatedShipment = payload.new as Shipment;
        setNotifications(prev => [`Shipment #${updatedShipment.id} status updated to ${updatedShipment.status}`, ...prev]);
        setShipments(prev => prev.map(shipment => 
          shipment.id === updatedShipment.id ? updatedShipment : shipment
        ));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const fetchShippingMethods = async () => {
    try {
      const methods = await methodService.getAll();
      setShippingMethods(methods);
      // Set default method in newShipment if not already set
      setNewShipment(prev => ({ ...prev, method: (methods && methods.length > 0) ? methods[0].id : 1 }));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user) return;
      
      const shipmentData = {
        sender: user.id,
        to_address: newShipment.to_address,
        weight: newShipment.weight,
        method: newShipment.method,
        status: "pending"
      };

      const createdShipment = await shipmentService.create(shipmentData);
      if (createdShipment) {
        setShipments([createdShipment, ...shipments]);
        setShowCreateModal(false);
        setNewShipment({ to_address: "", weight: 0, method: 1 });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTrackShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const shipmentData = await shipmentService.getById(Number(trackingId));
      
      if (shipmentData) {
        setSelectedShipment(shipmentData);
        setShowTrackModal(false);
        setTrackingId("");
      } else {
        setError("Shipment not found");
      }
    } catch (err: any) {
      setError("Shipment not found");
    }
  };

  const checkUser = async () => {
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) throw authError;
      
      if (!session?.user?.email) {
        router.push('/login');
        return;
      }

      const userData = await userService.getUserByEmail(session.user.email);
      
      if (!userData) {
        throw new Error("User not found");
      }
      
      setUser(userData);
      
      // Fetch shipments for this user
      const shipmentsData = await shipmentService.getShipmentsByUserId(userData.id);
      setShipments(shipmentsData);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    return statusMap[status as keyof typeof statusMap]?.label || "Unknown";
  };

  const getStatusStyle = (status: string) => {
    return statusMap[status as keyof typeof statusMap]?.style || "bg-gray-100 text-gray-800";
  };

  const handleCancelShipment = async () => {
    if (!shipmentToCancel || !user) return;

    try {
      const updatedShipment = await shipmentService.updateShipmentStatus(shipmentToCancel.id, "cancelled");
      if (updatedShipment) {
        setShipments(prev => prev.map(shipment =>
          shipment.id === shipmentToCancel.id ? updatedShipment : shipment
        ));
        setShowCancelConfirm(false);
        setShipmentToCancel(null);
        setNotifications(prev => [`Shipment #${shipmentToCancel.id} has been cancelled`, ...prev]);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filteredShipments = shipments.filter(shipment => {
    switch (activeTab) {
      case 'active':
        return shipment.status === "pending" || shipment.status === "picked_up" || shipment.status === "in_transit";
      case 'history':
        return shipment.status === "delivered" || shipment.status === "returned";
      case 'canceled':
        return shipment.status === "cancelled";
      default:
        return true;
    }
  });

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg fixed h-full">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">User Dashboard</h2>
        </div>
        <nav className="mt-6">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full px-6 py-4 text-left flex items-center space-x-3 transition-colors duration-200 ${
              activeTab === 'dashboard' 
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('shipments')}
            className={`w-full px-6 py-4 text-left flex items-center space-x-3 transition-colors duration-200 ${
              activeTab === 'shipments' 
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>Shipments</span>
          </button>
          <button
            onClick={() => router.push("/user/settings")}
            className={`w-full px-6 py-4 text-left flex items-center space-x-3 transition-colors duration-200 ${
              activeTab === 'settings' 
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64 p-8">
        {activeTab === 'dashboard' && (
          <div>
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Dashboard Overview</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Shipments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{shipments.length}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-full">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pending Shipments</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {shipments.filter(s => s.status === 'pending').length}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-full">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${shipments.reduce((sum, shipment) => {
                        const method = shippingMethods.find(m => m.id === shipment.method_id);
                        return sum + (method ? method.cost : 0);
                      }, 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-full">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shipments' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">My Shipments</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create New Shipment</span>
              </button>
            </div>

            {/* Shipments Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Address</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shipments.map((shipment) => (
                      <tr key={shipment.id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shipment.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(shipment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{shipment.to_address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{shipment.weight} kg</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {shipment.method?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(shipment.status)}`}>
                            {shipment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <button
                            onClick={() => setSelectedShipment(shipment)}
                            className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl w-[480px] shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Create New Shipment</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-500 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateShipment} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Address</label>
                <input
                  type="text"
                  value={newShipment.to_address || ''}
                  onChange={(e) => setNewShipment({ ...newShipment, to_address: e.target.value })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
                <input
                  type="number"
                  value={newShipment.weight || ''}
                  onChange={(e) => setNewShipment({ ...newShipment, weight: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Method</label>
                <select
                  value={newShipment.method_id || ''}
                  onChange={(e) => setNewShipment({ ...newShipment, method_id: Number(e.target.value) })}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a method</option>
                  {shippingMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name} - ${method.cost}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shipment Details Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl w-[480px] shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Shipment Details</h2>
              <button
                onClick={() => setSelectedShipment(null)}
                className="text-gray-400 hover:text-gray-500 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ID</p>
                  <p className="mt-1 text-gray-900">{selectedShipment.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="mt-1">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusStyle(selectedShipment.status)}`}>
                      {selectedShipment.status}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Method</p>
                  <p className="mt-1 text-gray-900">{selectedShipment.method?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Cost</p>
                  <p className="mt-1 text-gray-900">${selectedShipment.method?.cost || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Weight</p>
                  <p className="mt-1 text-gray-900">{selectedShipment.weight} kg</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">To Address</p>
                  <p className="mt-1 text-gray-900">{selectedShipment.to_address}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Created At</p>
                  <p className="mt-1 text-gray-900">{new Date(selectedShipment.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 