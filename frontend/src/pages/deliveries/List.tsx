import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { deliveriesApi, employeesApi } from "../../api/endpoints";
import type { Delivery, DeliveryStatus, Employee } from "../../api/types";
import Table from "../../components/ui/Table";
import Pagination from "../../components/ui/Pagination";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Input";
import { formatDate } from "../../lib/format";
import { errorMessage } from "../../api/client";

const STATUSES: DeliveryStatus[] = ["Pending", "Assigned", "OutForDelivery", "Delivered", "Failed", "Cancelled"];

export default function DeliveriesList() {
  const [data, setData] = useState<{ items: Delivery[]; totalCount: number }>({ items: [], totalCount: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  function load() {
    setLoading(true);
    deliveriesApi.list({ status: status || undefined, page, pageSize }).then((res) => setData(res.data)).finally(() => setLoading(false));
  }
  useEffect(load, [page, status]);
  useEffect(() => { employeesApi.list({ status: "Active", pageSize: 200 }).then((res) => setEmployees(res.data.items)); }, []);

  async function updateStatus(d: Delivery, newStatus: DeliveryStatus) {
    try {
      await deliveriesApi.updateStatus(d.id, newStatus);
      toast.success("Delivery status updated");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function assignDriver(d: Delivery, driverId: number) {
    try {
      await deliveriesApi.update(d.id, { driverEmployeeId: driverId, vehicle: d.vehicle, deliveryDate: d.deliveryDate, deliveryTime: d.deliveryTime, deliveryAddress: d.deliveryAddress, notes: d.notes });
      toast.success("Driver assigned");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Deliveries</h1>
        <p className="text-sm text-gray-500">Track order deliveries and assign drivers</p>
      </div>

      <div className="mb-3">
        <select className="border border-gray-300 rounded-md px-3 py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Table
        keyFn={(d) => d.id}
        loading={loading}
        rows={data.items}
        columns={[
          { header: "Order #", render: (d) => d.orderNumber },
          { header: "Customer", render: (d) => d.customerName },
          { header: "Delivery Date", render: (d) => d.deliveryDate ? formatDate(d.deliveryDate) : "-" },
          {
            header: "Driver", render: (d) => (
              <Select value={d.driverEmployeeId ?? ""} onChange={(e) => assignDriver(d, Number(e.target.value))} className="text-xs py-1">
                <option value="">Unassigned</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            )
          },
          { header: "Vehicle", render: (d) => d.vehicle ?? "-" },
          { header: "Status", render: (d) => <Badge value={d.status} /> },
          {
            header: "Update Status", render: (d) => (
              <select className="border border-gray-300 rounded-md px-2 py-1 text-xs" value="" onChange={(e) => e.target.value && updateStatus(d, e.target.value as DeliveryStatus)}>
                <option value="">Change status…</option>
                {STATUSES.filter((s) => s !== d.status).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )
          },
        ]}
      />
      <Pagination page={page} pageSize={pageSize} totalCount={data.totalCount} onPageChange={setPage} />
    </div>
  );
}
