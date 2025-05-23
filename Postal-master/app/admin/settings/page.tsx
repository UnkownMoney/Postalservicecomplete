"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { User, Method } from "@/model/interface";
import { userService } from "@/lib/services/userService";
import { methodService } from "@/lib/services/methodTypeService";

export default function AdminSettings() {
  const [users, setUsers] = useState<User[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'methods'>('users');
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [editMethod, setEditMethod] = useState<Method | null>(null);
  const [newMethod, setNewMethod] = useState({ name: '', cost: 0 });
  const router = useRouter();

  useEffect(() => {
    checkAdmin();
    fetchData();
  }, []);

  const checkAdmin = async () => {
    try {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      
      if (authError) throw authError;
      
      if (!session?.user?.email) {
        router.push('/login');
        return;
      }

      const user = await userService.getUserByEmail(session.user.email);
      
      if (!user || !user.priv) {
        router.push('/user');
        return;
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchData = async () => {
    try {
      const usersData = await userService.getAll();
      setUsers(usersData);

      const methodsData = await methodService.getAll();
      setMethods(methodsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: number, updates: Partial<User>) => {
    try {
      // Convert privilege value to boolean
      if (updates.priv !== undefined) {
        updates.priv = Boolean(updates.priv);
      }
      
      const updatedUser = await userService.update(userId, updates);
      if (updatedUser) {
        setUsers(users.map(user => user.id === userId ? updatedUser : user));
        setSelectedUser(null);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await userService.delete(userId);
      setUsers(users.filter(user => user.id !== userId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!newMethod.name || newMethod.cost === undefined) {
        setError("Please fill in all required fields for the new shipping method.");
        return;
      }

      const methodData = {
        name: newMethod.name,
        cost: Number(newMethod.cost)
      };

      const created = await methodService.create(methodData);
      if (created) {
        setMethods([...methods, created]);
        setShowMethodModal(false);
        setNewMethod({ name: '', cost: 0 });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditMethod = (method: Method) => {
    setEditMethod(method);
    setShowMethodModal(true);
    setNewMethod({ name: method.name, cost: method.cost });
  };

  const handleUpdateMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMethod) return;
    try {
      const updated = await methodService.update(editMethod.id, newMethod);
      if (updated) {
        setMethods(methods.map(m => m.id === editMethod.id ? updated : m));
        setShowMethodModal(false);
        setEditMethod(null);
        setNewMethod({ name: '', cost: 0 });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteMethod = async (id: number) => {
    if (!confirm('Are you sure you want to delete this shipping method?')) return;
    try {
      await methodService.delete(id);
      setMethods(methods.filter(m => m.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={() => setError(null)} 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={() => router.push('/admin')}
          className="mb-4 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          ← Back to Dashboard
        </button>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border'}`}>Users</button>
          <button onClick={() => setActiveTab('methods')} className={`px-4 py-2 rounded ${activeTab === 'methods' ? 'bg-blue-500 text-white' : 'bg-white text-gray-800 border'}`}>Shipping Methods</button>
        </div>

        {/* User Management Section */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">User Management</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Privilege</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.address}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.priv ? 1 : 0}
                          onChange={(e) => handleUpdateUser(user.id, { priv: e.target.value === '1' })}
                          className="rounded border-gray-300"
                        >
                          <option value={0}>Regular User</option>
                          <option value={1}>Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shipping Methods Section */}
        {activeTab === 'methods' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Shipping Methods</h2>
              <button
                onClick={() => {
                  setEditMethod(null);
                  setNewMethod({ name: '', cost: 0 });
                  setShowMethodModal(true);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add New Method
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {methods.map((method) => (
                    <tr key={method.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{method.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">${method.cost}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleEditMethod(method)}
                          className="text-blue-600 hover:text-blue-800 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMethod(method.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Method Modal */}
        {showMethodModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg w-96">
              <h2 className="text-xl font-bold mb-4">
                {editMethod ? 'Edit Shipping Method' : 'Add New Shipping Method'}
              </h2>
              <form onSubmit={editMethod ? handleUpdateMethod : handleCreateMethod}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={newMethod.name}
                    onChange={(e) => setNewMethod({ ...newMethod, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Cost</label>
                  <input
                    type="number"
                    value={newMethod.cost}
                    onChange={(e) => setNewMethod({ ...newMethod, cost: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMethodModal(false);
                      setEditMethod(null);
                      setNewMethod({ name: '', cost: 0 });
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    {editMethod ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 