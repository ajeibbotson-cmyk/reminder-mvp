import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, TrendingUp, TrendingDown, Users, FileText, DollarSign, Clock } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-600">Financial insights and performance metrics for your UAE business</p>
        </div>
        <div className="flex gap-3">
          <Select defaultValue="30d">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AED 125,430</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Amount</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">AED 45,200</div>
            <div className="flex items-center text-xs text-red-600">
              <TrendingDown className="h-3 w-3 mr-1" />
              -5.2% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">342</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +8.1% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +2.3% from last month
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial">Financial Reports</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="customers">Customer Analysis</TabsTrigger>
          <TabsTrigger value="compliance">UAE Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Breakdown</CardTitle>
                <CardDescription>Monthly revenue trends in AED</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>January 2024</span>
                    <span className="font-medium">AED 98,500</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>February 2024</span>
                    <span className="font-medium">AED 112,300</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>March 2024</span>
                    <span className="font-medium">AED 125,430</span>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Q1 Total</span>
                      <span>AED 336,230</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Status Distribution</CardTitle>
                <CardDescription>Current invoice payment status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-100 text-green-800">Paid</Badge>
                      <span>67%</span>
                    </div>
                    <span className="font-medium">AED 84,038</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      <span>23%</span>
                    </div>
                    <span className="font-medium">AED 28,849</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-red-100 text-red-800">Overdue</Badge>
                      <span>10%</span>
                    </div>
                    <span className="font-medium">AED 12,543</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>VAT Summary</CardTitle>
              <CardDescription>UAE VAT (5%) collection summary</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">AED 6,272</div>
                  <p className="text-sm text-gray-600">VAT Collected</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">AED 5,890</div>
                  <p className="text-sm text-gray-600">VAT Paid</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">AED 382</div>
                  <p className="text-sm text-gray-600">VAT Outstanding</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Collection Performance</CardTitle>
                <CardDescription>Average collection time and success rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Average Collection Time</span>
                    <Badge variant="outline">18 days</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Collection Success Rate</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">89.2%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Follow-up Email Open Rate</span>
                    <Badge variant="outline">67.8%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Response Rate</span>
                    <Badge variant="outline">34.5%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aging Analysis</CardTitle>
                <CardDescription>Outstanding invoices by age</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>0-30 days</span>
                    <span className="font-medium">AED 28,400</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>31-60 days</span>
                    <span className="font-medium">AED 12,100</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>61-90 days</span>
                    <span className="font-medium">AED 3,200</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>90+ days</span>
                    <span className="font-medium text-red-600">AED 1,500</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Customers by Revenue</CardTitle>
              <CardDescription>Your most valuable clients this period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Emirates Construction LLC</p>
                    <p className="text-sm text-gray-600">TRN: 100123456789012</p>
                  </div>
                  <span className="font-bold">AED 45,230</span>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Dubai Tech Solutions</p>
                    <p className="text-sm text-gray-600">TRN: 100234567890123</p>
                  </div>
                  <span className="font-bold">AED 32,150</span>
                </div>
                <div className="flex justify-between items-center p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Abu Dhabi Trading Co</p>
                    <p className="text-sm text-gray-600">TRN: 100345678901234</p>
                  </div>
                  <span className="font-bold">AED 28,900</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>UAE Compliance Status</CardTitle>
                <CardDescription>Regulatory compliance tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>VAT Registration Compliance</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">Compliant</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>TRN Validation Rate</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">100%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>E-invoicing Readiness</span>
                    <Badge variant="default" className="bg-blue-100 text-blue-800">Ready</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Business Hours Compliance</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cultural Compliance Score</CardTitle>
                <CardDescription>Email tone and cultural appropriateness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-4xl font-bold text-green-600">92%</div>
                  <p className="text-sm text-gray-600">Excellent cultural compliance</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Arabic Support</p>
                      <p className="text-gray-600">95%</p>
                    </div>
                    <div>
                      <p className="font-medium">Islamic Etiquette</p>
                      <p className="text-gray-600">89%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Compliance Alerts</CardTitle>
              <CardDescription>System-generated compliance notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">All invoices include valid TRN numbers</p>
                    <p className="text-xs text-gray-600">Last checked: 2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">UAE holiday calendar updated for Ramadan 2024</p>
                    <p className="text-xs text-gray-600">Updated: Yesterday</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div>
                    <p className="text-sm font-medium">E-invoicing mandate preparation reminder</p>
                    <p className="text-xs text-gray-600">Due: July 2026</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}