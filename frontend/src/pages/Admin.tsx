import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Users, ShoppingCart, DollarSign, BarChart3, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";

const API_URL = "/api";

export default function Admin() {
  const [apiKey, setApiKey] = useState<string>("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Subscriber management
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newTier, setNewTier] = useState("free");
  const [editing, setEditing] = useState<any>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editTier, setEditTier] = useState("free");
  
  // Orders modal
  const [showOrders, setShowOrders] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<string | null>(null);
  const [subscriberOrders, setSubscriberOrders] = useState<any[]>([]);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_api_key");
    if (saved) {
      setApiKey(saved);
      setLoggedIn(true);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    fetchData();
  }, [loggedIn]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const key = sessionStorage.getItem("admin_api_key") || apiKey;
      
      const [analyticsRes, subscribersRes] = await Promise.all([
        fetch(`${API_URL}/admin/analytics`, { headers: { "X-API-KEY": key } }),
        fetch(`${API_URL}/admin/subscribers`, { headers: { "X-API-KEY": key } })
      ]);
      
      if (!analyticsRes.ok || !subscribersRes.ok) throw new Error("Invalid API key");
      
      const analyticsData = await analyticsRes.json();
      const subscribersData = await subscribersRes.json();
      
      setAnalytics(analyticsData);
      setSubscribers(subscribersData.subscribers || []);
    } catch (err) {
      setError("Failed to load data");
      setLoggedIn(false);
      sessionStorage.removeItem("admin_api_key");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    sessionStorage.setItem("admin_api_key", apiKey);
    setLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_api_key");
    setLoggedIn(false);
    setApiKey("");
  };

  const fetchSubscriberOrders = async (email: string) => {
    setSelectedSubscriber(email);
    setShowOrders(true);
    try {
      const key = sessionStorage.getItem("admin_api_key") || apiKey;
      const res = await fetch(`${API_URL}/admin/subscribers/${encodeURIComponent(email)}/orders`, {
        headers: { "X-API-KEY": key }
      });
      const data = await res.json();
      setSubscriberOrders(data.orders || []);
    } catch {
      setSubscriberOrders([]);
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, tier: newTier })
      });
      setNewEmail("");
      setNewTier("free");
      setShowAddForm(false);
      fetchData();
    } catch {
      alert("Failed to add subscriber");
    }
  };

  const handleDeleteSubscriber = async (email: string) => {
    if (!confirm(`Delete ${email}?`)) return;
    try {
      const key = sessionStorage.getItem("admin_api_key") || apiKey;
      await fetch(`${API_URL}/admin/subscribers`, {
        method: "DELETE",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      fetchData();
    } catch {
      alert("Failed to delete");
    }
  };

  const handleEditSubscriber = (sub: any) => {
    setEditing(sub);
    setEditEmail(sub.email);
    setEditTier(sub.tier);
  };

  const handleSaveEdit = async () => {
    try {
      const key = sessionStorage.getItem("admin_api_key") || apiKey;
      await fetch(`${API_URL}/admin/subscribers`, {
        method: "PUT",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ originalEmail: editing.email, newEmail: editEmail, tier: editTier })
      });
      setEditing(null);
      fetchData();
    } catch {
      alert("Failed to update");
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Admin Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">API Key</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter admin API key"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full">Login</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const statCards = [
    { label: "Total Views", value: analytics?.summary?.totalViews || 0, icon: Eye, trend: analytics?.summary?.weekViews || 0 },
    { label: "Unique Visitors", value: analytics?.summary?.uniqueVisitors || 0, icon: Users, trend: null },
    { label: "Orders", value: analytics?.summary?.totalOrders || 0, icon: ShoppingCart, trend: analytics?.summary?.monthOrders || 0 },
    { label: "Revenue", value: formatCurrency(analytics?.summary?.totalRevenue || 0), icon: DollarSign, trend: formatCurrency(analytics?.summary?.monthRevenue || 0) }
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Admin Dashboard
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchData} size="sm">Refresh</Button>
            <Button variant="outline" onClick={handleLogout} size="sm">Logout</Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((card, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                  <card.icon className="w-8 h-8 text-muted-foreground" />
                </div>
                {card.trend !== null && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    {typeof card.trend === 'number' && card.trend > 0 ? (
                      <><TrendingUp className="w-3 h-3 text-green-500" />+{card.trend}</>
                    ) : typeof card.trend === 'string' ? (
                      <>{card.trend}</>
                    ) : (
                      <><Minus className="w-3 h-3" />0</>
                    )}
                    <span className="ml-1">{i === 3 ? "this month" : "this week/month"}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Daily Views Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Views (14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.dailyViews?.length > 0 ? (
                <div className="flex items-end gap-1 h-32">
                  {analytics.dailyViews.map((day: any, i: number) => {
                    const max = Math.max(...analytics.dailyViews.map((d: any) => d.count));
                    const height = max > 0 ? (day.count / max) * 100 : 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-primary rounded-t" style={{ height: `${height}%`, minHeight: day.count > 0 ? 4 : 0 }} />
                        <span className="text-xs text-muted-foreground -rotate-45 origin-left translate-y-2">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-300">No view data yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.recentOrders?.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {analytics.recentOrders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="text-sm font-medium">{order.product_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{formatCurrency(order.amount)}</p>
                        <span className={`text-xs font-medium ${order.status === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Top Pages */}
          <Card>
            <CardHeader><CardTitle>Top Pages</CardTitle></CardHeader>
            <CardContent>
              {analytics?.topPages?.length > 0 ? (
                <div className="space-y-1">
                  {analytics.topPages.slice(0, 5).map((page: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="truncate max-w-xs">{page.path}</span>
                      <span className="text-muted-foreground">{page.count} views</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-300">No page data yet — traffic will appear here.</p>
              )}
            </CardContent>
          </Card>

          {/* Top Referrers */}
          <Card>
            <CardHeader><CardTitle>Top Referrers</CardTitle></CardHeader>
            <CardContent>
              {analytics?.topReferrers?.length > 0 ? (
                <div className="space-y-1">
                  {analytics.topReferrers.slice(0, 5).map((ref: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="truncate max-w-xs">{ref.referrer || 'Direct'}</span>
                      <span className="text-muted-foreground">{ref.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No referrer data.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subscribers */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Subscribers ({subscribers.length})</CardTitle>
            <Button size="sm" onClick={() => setShowAddForm(true)}>+ Add</Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Email</th>
                    <th className="py-2">Tier</th>
                    <th className="py-2">Joined</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.email} className="border-b">
                      <td className="py-3">{sub.email}</td>
                      <td className="py-3">
                        <span className={`text-xs font-medium ${sub.tier === 'premium' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>{sub.tier}</span>
                      </td>
                      <td className="py-3 text-muted-foreground">{new Date(sub.joined_at).toLocaleDateString()}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => fetchSubscriberOrders(sub.email)} title="View orders">🛒</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditSubscriber(sub)} title="Edit">✏️</Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteSubscriber(sub.email)} title="Delete">🗑️</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Orders Modal */}
        {showOrders && (
          <Card className="mb-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Orders: {selectedSubscriber}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowOrders(false)}>✕</Button>
            </CardHeader>
            <CardContent>
              {subscriberOrders.length === 0 ? (
                <p className="text-muted-foreground">No orders found.</p>
              ) : (
                <div className="space-y-2">
                  {subscriberOrders.map((order: any) => (
                    <div key={order.id} className="flex justify-between items-center p-2 bg-muted rounded">
                      <div>
                        <p className="font-medium">{order.product_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p>{formatCurrency(order.amount)}</p>
                        <span className={`text-xs font-medium ${order.status === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Add Form */}
        {showAddForm && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Add Subscriber</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleAddSubscriber} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-xs mb-1 block">Email</label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs mb-1 block">Tier</label>
                  <select value={newTier} onChange={(e) => setNewTier(e.target.value)} className="border rounded px-3 py-2 bg-background text-foreground">
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Add</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Edit Modal */}
        {editing && (
          <Card className="mb-8">
            <CardHeader><CardTitle>Edit Subscriber</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-xs mb-1 block">Email</label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs mb-1 block">Tier</label>
                  <select value={editTier} onChange={(e) => setEditTier(e.target.value)} className="border rounded px-3 py-2 bg-background text-foreground">
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* External Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              External Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="w-4 h-4" />
                Google Search Console
              </a>
              <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="w-4 h-4" />
                Stripe Dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
