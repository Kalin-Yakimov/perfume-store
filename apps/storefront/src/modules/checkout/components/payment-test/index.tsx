import { Badge } from "@modules/common/components/ui"

const PaymentTest = ({ className }: { className?: string }) => {
  return (
    <Badge color="orange" className={className}>
      <span className="font-semibold">Тестов режим:</span> Не се извършва реално
      плащане.
    </Badge>
  )
}

export default PaymentTest
