import { useNavigate } from "react-router-dom"

import PerfumeForm, { type FullPerfume } from "../perfume-form"

const CreateFullPerfumePage = () => {
  const navigate = useNavigate()

  const onSaved = (product: FullPerfume) => {
    navigate(`/full-perfumes/${product.id}`)
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="bg-ui-bg-base shadow-elevation-card-rest rounded-lg border px-6 py-5">
        <p className="text-ui-fg-subtle text-xs uppercase tracking-widest">
          Нов парфюм
        </p>
        <h1 className="mt-1 text-xl font-semibold">Добавяне на цяла бутилка</h1>
        <p className="text-ui-fg-subtle mt-2 max-w-3xl text-sm">
          Попълнете само нужните за магазина данни. Кодът на артикула и
          техническият вариант ще се създадат автоматично. Новият парфюм
          остава скрит за клиентите, докато довършите профила му.
        </p>
      </section>
      <PerfumeForm onSaved={onSaved} />
    </div>
  )
}

export default CreateFullPerfumePage
