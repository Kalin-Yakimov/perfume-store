import { Button, Heading, Text } from "@medusajs/ui"

export default function DataError({
  title,
  onRetry,
  isRetrying = false,
}: {
  title: string
  onRetry: () => void
  isRetrying?: boolean
}) {
  return (
    <div className="px-6 py-8" role="alert">
      <Heading level="h2">{title}</Heading>
      <Text className="text-ui-fg-subtle mt-2">
        Информацията временно не може да бъде заредена. Опитайте отново.
      </Text>
      <Button
        variant="secondary"
        className="mt-3"
        onClick={onRetry}
        isLoading={isRetrying}
      >
        Опитай отново
      </Button>
    </div>
  )
}
