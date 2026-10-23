import type { StrudelFunctionDocumentation } from '../types'

const createElement = (tagName: string, className: string, text = ''): HTMLElement => {
  const element = document.createElement(tagName)
  element.className = className
  element.textContent = text
  return element
}

/**
 * The documentation panel for one Strudel function, shown beside the completion list and in
 * the tooltip over a function name: its signature, other names, description, parameters and
 * first example.
 * @param functionDocumentation - the function's generated documentation
 * @param label - the name it was reached by, which may be one of its synonyms
 * @returns the panel element
 */
export const renderFunctionDocumentation = (
  functionDocumentation: StrudelFunctionDocumentation,
  label: string
): HTMLElement => {
  const container = createElement('div', 'cm-strudel-doc')
  const otherNames = [functionDocumentation.name, ...functionDocumentation.synonyms].filter(
    (name) => name !== label
  )
  const parameterNames = functionDocumentation.params.map((parameter) => parameter.name).join(', ')
  container.append(
    createElement('strong', 'cm-strudel-doc__signature', `${label}(${parameterNames})`)
  )
  if (otherNames.length > 0) {
    container.append(
      createElement('p', 'cm-strudel-doc__synonyms', `Also: ${otherNames.join(', ')}`)
    )
  }
  functionDocumentation.description
    .split('\n\n')
    .forEach((paragraph) => container.append(createElement('p', 'cm-strudel-doc__text', paragraph)))
  if (functionDocumentation.params.length > 0) {
    const parameterList = createElement('ul', 'cm-strudel-doc__params')
    functionDocumentation.params.forEach((parameter) => {
      const parameterItem = createElement('li', 'cm-strudel-doc__param')
      parameterItem.append(
        createElement('code', 'cm-strudel-doc__param-name', parameter.name),
        ` ${[parameter.type, parameter.description].filter((part) => part.length > 0).join(': ')}`
      )
      parameterList.append(parameterItem)
    })
    container.append(parameterList)
  }
  const [firstExample] = functionDocumentation.examples
  if (firstExample !== undefined) {
    container.append(createElement('pre', 'cm-strudel-doc__example', firstExample))
  }
  return container
}
