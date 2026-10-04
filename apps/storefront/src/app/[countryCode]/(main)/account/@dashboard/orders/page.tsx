import { Metadata } from "next"

import OrderOverview from "@modules/account/components/order-overview"
import { redirect } from "next/navigation"
import { listOrdersPage } from "@lib/data/orders"
import { retrieveCustomerSummary } from "@lib/data/customer-read"
import Divider from "@modules/common/components/divider"
import TransferRequestForm from "@modules/account/components/transfer-request-form"
import { Pagination } from "@modules/store/components/pagination"
import { parsePage } from "@lib/util/parse-page"

export const metadata: Metadata = {
  title: "Моите поръчки",
  description: "История и състояние на вашите поръчки.",
}

export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  if (!(await retrieveCustomerSummary())) return null
  const page = parsePage((await searchParams).page)
  const { orders, count } = await listOrdersPage(10, (page - 1) * 10)
  const totalPages = Math.max(1, Math.ceil(count / 10))
  if (page > totalPages) redirect(`/vhod/porachki?page=${totalPages}`)

  return (
    <div className="w-full" data-testid="orders-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Моите поръчки</h1>
        <p className="text-base-regular">
          Прегледайте предишните си поръчки и тяхното състояние.
        </p>
      </div>
      <div>
        <OrderOverview orders={orders} />
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            data-testid="orders-pagination"
          />
        )}
        <Divider className="mb-8 mt-8" />
        <TransferRequestForm />
      </div>
    </div>
  )
}
