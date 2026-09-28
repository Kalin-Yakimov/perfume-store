import { Button, Heading, Text } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

const SignInPrompt = () => {
  return (
    <div className="flex flex-col items-start justify-between gap-4 border-b border-[#ded7cf] pb-5 xsmall:flex-row xsmall:items-center">
      <div>
        <Heading
          level="h2"
          className="font-display text-xl font-normal text-[#211d19]"
        >
          Имате профил?
        </Heading>
        <Text className="mt-1 text-sm leading-6 text-[#71665c]">
          Влезте в профила си, за да продължите по-бързо.
        </Text>
      </div>
      <div>
        <LocalizedClientLink href="/account">
          <Button
            variant="secondary"
            className="h-10 rounded-none border-[#cfc3b6] bg-transparent px-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#211d19] hover:bg-[#eee8e0]"
            data-testid="sign-in-button"
          >
            Вход
          </Button>
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export default SignInPrompt
