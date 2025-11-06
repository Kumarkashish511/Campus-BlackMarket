import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, AlertTriangle, Users, Package } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Report = Database['public']['Tables']['reports']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

export function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalProducts: 0, pendingReports: 0 });

  useEffect(() => {
    fetchReports();
    fetchUsers();
    fetchStats();
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [usersCount, productsCount, reportsCount] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalUsers: usersCount.count || 0,
        totalProducts: productsCount.count || 0,
        pendingReports: reportsCount.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleBanUser = async (userId: string, shouldBan: boolean) => {
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ is_banned: shouldBan })
        .eq('id', userId);

      if (error) throw error;
      fetchUsers();
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const handleResolveReport = async (reportId: string) => {
    try {
      const { error } = await (supabase.from('reports') as any)
        .update({ status: 'resolved' as const, resolved_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) throw error;
      fetchReports();
      fetchStats();
    } catch (error) {
      console.error('Error resolving report:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Products</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pending Reports</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pendingReports}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              Recent Reports
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reports.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No reports</p>
              ) : (
                reports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        report.status === 'pending'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                          : report.status === 'resolved'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      }`}>
                        {report.status}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">
                      {report.reason}
                    </p>
                    {report.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {report.description}
                      </p>
                    )}
                    {report.status === 'pending' && (
                      <button
                        onClick={() => handleResolveReport(report.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              User Management
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {user.full_name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                        {user.role}
                      </span>
                      {user.is_banned && (
                        <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                          Banned
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleBanUser(user.id, !user.is_banned)}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      user.is_banned
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {user.is_banned ? 'Unban' : 'Ban'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
