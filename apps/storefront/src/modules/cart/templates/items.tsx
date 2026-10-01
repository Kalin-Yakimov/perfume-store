import repeat from "@lib/util/repeat"
import { HttpTypes } from "@medusajs/types"
import { Heading, Table } from "@modules/common/components/ui"

import Item from "@modules/cart/components/item"
import SkeletonLineItem from "@modules/skeletons/components/skeleton-line-item"
import { CartMutationProvider } from "@lib/context/cart-mutation-context"
import { getCartStockRevision } from "@lib/util/cart-stock-revision"

type ItemsTemplateProps = {
  cart?: HttpTypes.StoreCart
}

const ItemsTemplate = ({ cart }: ItemsTemplateProps) => {
  const items = cart?.items
  return (
    <div>
      <div className="mb-5 border-b border-[#ded7cf] pb-5">
        <Heading
          level="h2"
          className="font-display text-2xl font-normal leading-tight text-[#211d19]"
        >
          Продукти
        </Heading>
      </div>
      <div>
        <CartMutationProvider revision={getCartStockRevision(cart)}>
          <Table className="w-full">
            <Table.Header className="hidden border-t-0 small:table-header-group">
              <Table.Row className="border-[#ded7cf] text-[10px] font-semibold uppercase tracking-[0.16em] text-[#806e60] hover:bg-transparent">
                <Table.HeaderCell className="!pl-0">Продукт</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
                <Table.HeaderCell>Количество</Table.HeaderCell>
                <Table.HeaderCell className="hidden small:table-cell">
                  Цена
                </Table.HeaderCell>
                <Table.HeaderCell className="!pr-0 text-right">
                  Общо
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body className="block small:table-row-group">
              {items
                ? [...items]
                    .sort((a, b) => {
                      return (a.created_at ?? "") > (b.created_at ?? "")
                        ? -1
                        : 1
                    })
                    .map((item) => {
                      return (
                        <Item
                          key={item.id}
                          item={item}
                          currencyCode={cart?.currency_code}
                        />
                      )
                    })
                : repeat(5).map((i) => {
                    return <SkeletonLineItem key={i} />
                  })}
            </Table.Body>
          </Table>
        </CartMutationProvider>
      </div>
    </div>
  )
}

export default ItemsTemplate
