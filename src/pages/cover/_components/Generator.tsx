import { Button } from '@/components/ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import { type ReactNode, forwardRef, useEffect, useRef, useState } from 'react'

import { FormProvider, useForm } from './FormContext'

export default function CoverLetterGenerator() {
  const ref = useRef<HTMLDivElement>(null)
  const [showForm, showFormAssign] = useState(false)
  const [isCopied, isCopiedAssign] = useState(false)

  const handleClick = () => {
    const content = ref.current
    if (!content) return

    const text = content.innerHTML
      .replace(/\<div\>|\<\/div\>/g, '')
      .replace(/\<\/p\>\<p\>/g, '\n\n')
      .replace(/(\<p[^>]*\>|\<\/p\>|\<span[^>]*\>|\<\/span\>)/g, '')
      .replaceAll('<!-- -->', '')

    const blob = new Blob([text], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'cover.txt'
    link.click()
  }
  const copyText = () => {
    const content = ref.current
    if (!content) return

    const text = content.innerHTML
      .replace(/\<div\>|\<\/div\>/g, '')
      .replace(/\<\/p\>\<p\>/g, '\n\n')
      .replace(/(\<p[^>]*\>|\<\/p\>|\<span[^>]*\>|\<\/span\>)/g, '')
      .replaceAll('<!-- -->', '')

    navigator.clipboard
      .writeText(text)
      .then(() => isCopiedAssign(true))
      .catch(err => console.error(err))
  }

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const updateSize = () => {
      if (!element) return

      element.style.setProperty('--form-height', `${element.offsetHeight}px`)
    }
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    updateSize()

    return () => observer?.unobserve(element)
  }, [])
  useEffect(() => {
    const timeout = setTimeout(() => isCopiedAssign(false), 2000)
    return () => clearTimeout(timeout)
  }, [isCopied])

  return (
    <FormProvider>
      <>
        <header className="flex flex-col gap-6 @md:flex-row @md:gap-4">
          <Button
            onClick={handleClick}
            className="bg-primary text-primary-foreground flex-grow px-3 py-1 text-lg hover:bg-cyan-600 sm:px-8 sm:py-3"
          >
            Download
          </Button>

          <Button
            onClick={copyText}
            className="bg-primary text-primary-foreground flex-grow px-3 py-1 text-lg hover:bg-cyan-600 sm:px-8 sm:py-3"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </Button>

          <Button
            onClick={() => showFormAssign(p => !p)}
            variant="outline"
            className="border-primary text-secondary-foreground bg-transparent hover:bg-cyan-500"
          >
            <Settings className="h-6 w-6" />
          </Button>
        </header>

        <Output showForm={showForm} ref={ref} />
      </>
    </FormProvider>
  )
}

const Output = forwardRef<HTMLDivElement, { showForm: boolean }>(
  (props, ref) => {
    const { state } = useForm()

    return (
      <div className="overflow-auto pt-4 lg:mx-auto">
        <div ref={ref} className="relative space-y-4">
          <p>
            Dear <Field placeholder="Company" value={state.companyName.value} />{' '}
            Talent Acquisition team,
          </p>

          <p>
            I am reaching out to express my interest in the{' '}
            <Field
              placeholder="Software Engineer"
              value={state.position.value}
            />{' '}
            position
            {state.source.show ? (
              <>
                {' '}
                recently advertised on{' '}
                <Field
                  placeholder="Job Site/Career site"
                  value={state.source.value}
                />
              </>
            ) : null}
            .
          </p>

          <p>
            After thoroughly analyzing the job description, I recognized three
            primary requirements essential for success in this role: expertise
            in modern JavaScript frameworks, proficiency in building scalable
            cloud-based architectures, and a strong track record in managing
            full lifecycle software development projects. My background and
            skills align well with these expectations.
          </p>

          <p>
            My technical proficiency in JavaScript, TypeScript, and frameworks
            like Node.js, React, and Vue, supplemented by my hands-on experience
            with cloud services like Docker and databases such as PostgreSQL and
            MongoDB, enable me to construct and scale effective software
            solutions efficiently. At Bond, I led the development of
            high-traffic web applications for the entertainment sector, which
            not only met but exceeded performance benchmarks through strategic
            use of these technologies.
          </p>

          <p>
            Furthermore, I have a solid foundation in designing and deploying
            robust cloud-based architectures, essential for ensuring high
            availability and resilience of system infrastructures. For example,
            at American Express, I architected the transition of a GraphQL
            repository to a federated model, enhancing system flexibility and
            performance, demonstrating my capability to innovate and improve
            existing systems.
          </p>

          <p>
            Lastly, my role at Linear Systems Inc involved overseeing projects
            from conception through to deployment, emphasizing the importance of
            meticulous project management. This experience sharpened my ability
            to manage project timelines and deliverables effectively, ensuring
            all phases of the software development lifecycle are executed to the
            highest standard, which I am eager to leverage at{' '}
            <Field placeholder="Company" value={state.companyName.value} />.
          </p>

          <p>
            I would be delighted to be granted an opportunity for an interview,
            during which I can tell you more about my skills and experience, and
            prove to you that I am the right fit for this role. I hope that you
            will give me a chance to contribute to your mission and growth going
            forward. I look forward to hearing from you.
          </p>

          <div>
            <p>Yours sincerely,</p>
            <p>{state.name.value}</p>
            <p>{state.email.value}</p>
            {state.phone.show ? <p>{state.phone.value}</p> : null}
          </div>

          <AnimatePresence>{props.showForm ? <Form /> : null}</AnimatePresence>
        </div>
      </div>
    )
  }
)

function Field({ placeholder, value }: { placeholder: string; value: string }) {
  return value ? (
    <span>{value}</span>
  ) : (
    <span className="font-semibold text-red-500">[{placeholder}]</span>
  )
}

function Form() {
  const { state, dispatch } = useForm()

  return (
    <motion.div
      initial={{ x: '-100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="bg-primary text-primary-foreground absolute inset-0 top-4 -mx-px !-mt-4 h-[--form-height] space-y-6 pt-4 backdrop-blur-xl"
    >
      <section>
        <h2 className="bg-white/10 px-2 py-1 pb-2 text-xl font-semibold">
          Company Info
        </h2>

        <div className="space-y-4 px-4 pt-8">
          <TextInput
            id="position"
            label="Position"
            name="position"
            value={state.position.value}
            update={payload => dispatch({ type: 'positionAssign', payload })}
            autoFocus={true}
          />

          <TextInput
            id="source"
            label="Source"
            name="source"
            value={state.source.value}
            update={payload => dispatch({ type: 'sourceAssign', payload })}
            checkbox={
              <Checkbox
                id="use-source"
                checked={state.source.show}
                update={payload =>
                  dispatch({
                    type: 'sourceShow',
                    payload,
                  })
                }
              />
            }
          />

          <TextInput
            id="company-name"
            label="Company"
            name="company-name"
            value={state.companyName.value}
            update={payload => dispatch({ type: 'companyNameAssign', payload })}
            checkbox={
              <Checkbox
                id="use-company-name"
                checked={state.companyName.show}
                update={payload =>
                  dispatch({
                    type: 'companyNameShow',
                    payload,
                  })
                }
              />
            }
          />
        </div>
      </section>
    </motion.div>
  )
}
function Checkbox({
  checked,
  id,
  update,
}: Partial<HTMLInputElement> & { update: (b: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <label htmlFor={id}>Use?</label>

      <input
        type="checkbox"
        className="p-2 outline-offset-4"
        id={id}
        checked={checked}
        onChange={e => update(e.target.checked)}
      />
    </div>
  )
}
function TextInput({
  autoFocus,
  checkbox,
  id,
  label,
  name,
  value,
  update,
}: Partial<HTMLInputElement> & {
  checkbox?: ReactNode
  label: string
  update: (s: string) => void
  autoFocus?: boolean
}) {
  return (
    <fieldset
      className={`grid items-end justify-start gap-4 ${checkbox ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[auto_1fr]'}`}
    >
      <label htmlFor={id}>{label}</label>

      <input
        type="text"
        className="border-b-border hover:border-b-primary focus:border-primary rounded-t-md border-b-2 bg-transparent p-2 pb-1 outline-none hover:bg-white/10 focus:bg-white/10"
        id={id}
        name={name}
        value={value}
        onChange={e => update(e.target.value)}
        autoFocus={autoFocus}
      />

      {checkbox}
    </fieldset>
  )
}
