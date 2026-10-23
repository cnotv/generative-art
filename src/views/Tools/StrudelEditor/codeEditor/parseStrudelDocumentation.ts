import type { StrudelFunctionDocumentation, StrudelFunctionParameter } from '../types'

type DocumentationTag = {
  title: string
  lines: string[]
}

type DocumentationComment = {
  descriptionLines: string[]
  tags: DocumentationTag[]
}

// The code line is only looked at, so a comment that directly follows another is still matched.
const DOCUMENTATION_COMMENT_PATTERN = /\/\*\*([\S\s]*?)\*\/(?=[\t ]*\n?(?:[\t ]*\n)*([^\n]*))/g
const COMMENT_LINE_PREFIX = /^\s*\*?\s?/
const TAG_LINE = /^@(\w+)\s*(.*)$/
const PARAMETER_TAG = /^{([^}]*)}\s+\[?([\w$.]+)(?:=[^\]]*)?]?\s*-?\s*(.*)$/
const MARKUP_TAG = /<[^>]+>/g
const MARKDOWN_BOLD = /\*\*([^*]+)\*\*/g
const IDENTIFIER = '[A-Za-z_$][\\w$]*'
const REGISTERED_NAMES = /register\(\s*(\[[^\]]*]|'[^']*'|"[^"]*")/
const QUOTED_NAME = /["']([^"']+)["']/g
const DESTRUCTURED_EXPORT = /^export\s+(?:const|let)\s+{([^}]*)}/
const DECLARATION = new RegExp(
  `^(?:export\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class)\\s+(${IDENTIFIER})`
)
const PROTOTYPE_ASSIGNMENT = new RegExp(`^Pattern\\.prototype\\.(${IDENTIFIER})\\s*=`)
const METHOD_DEFINITION = new RegExp(`^(${IDENTIFIER})\\s*\\([^)]*\\)\\s*\\{`)
const OBJECT_KEY = new RegExp(`^(${IDENTIFIER})\\s*:`)
const STATEMENT_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function'])
const HIDDEN_TAGS = new Set(['noAutocomplete', 'superdirtOnly', 'deprecated', 'private'])
const REGISTERED_WIDGET = /registerWidget\(\s*["'](_\w+)["']/g

const readDocumentationComment = (commentBody: string): DocumentationComment =>
  commentBody
    .split('\n')
    .map((line) => line.replace(COMMENT_LINE_PREFIX, ''))
    .reduce<DocumentationComment>(
      (documentationComment, line) => {
        const tagMatch = TAG_LINE.exec(line.trim())
        if (tagMatch) {
          const tagText = tagMatch[2] ?? ''
          return {
            ...documentationComment,
            tags: [
              ...documentationComment.tags,
              { title: tagMatch[1] ?? '', lines: tagText ? [tagText] : [] }
            ]
          }
        }
        const lastTag = documentationComment.tags.at(-1)
        if (lastTag === undefined) {
          return {
            ...documentationComment,
            descriptionLines: [...documentationComment.descriptionLines, line]
          }
        }
        return {
          ...documentationComment,
          tags: [
            ...documentationComment.tags.slice(0, -1),
            { ...lastTag, lines: [...lastTag.lines, line] }
          ]
        }
      },
      { descriptionLines: [], tags: [] }
    )

const toPlainText = (text: string): string =>
  text.replace(MARKUP_TAG, '').replace(MARKDOWN_BOLD, '$1')

const joinWrappedLines = (lines: string[]): string =>
  lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(' ')

const toParagraphs = (lines: string[]): string =>
  lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((paragraph) => toPlainText(joinWrappedLines(paragraph.split('\n'))))
    .filter((paragraph) => paragraph.length > 0)
    .join('\n\n')

const trimBlankEdges = (lines: string[]): string[] => {
  const firstContent = lines.findIndex((line) => line.trim().length > 0)
  const lastContent = lines.findLastIndex((line) => line.trim().length > 0)
  return firstContent === -1 ? [] : lines.slice(firstContent, lastContent + 1)
}

const toExample = (lines: string[]): string => trimBlankEdges(lines).join('\n').trimEnd()

const toParameter = (lines: string[]): StrudelFunctionParameter | null => {
  const [firstLine = '', ...continuation] = lines
  const parameterMatch = PARAMETER_TAG.exec(firstLine.trim())
  if (!parameterMatch) {
    return null
  }
  return {
    name: parameterMatch[2] ?? '',
    type: (parameterMatch[1] ?? '').trim(),
    description: toPlainText(joinWrappedLines([parameterMatch[3] ?? '', ...continuation]))
  }
}

const tagValues = (documentationComment: DocumentationComment, title: string): string[][] =>
  documentationComment.tags.filter((tag) => tag.title === title).map((tag) => tag.lines)

const splitNameList = (nameList: string): string[] =>
  nameList
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)

/**
 * The names the code after a doc comment declares, since many Strudel comments carry no `@name` tag
 * and leave jsdoc to infer it. The first is the function's name and the rest are its aliases.
 * @param codeLine - the first line of code after the comment
 * @returns the declared names, empty when the line declares nothing nameable
 */
const namesDeclaredBy = (codeLine: string): string[] => {
  const trimmedLine = codeLine.trim()
  const registeredNames = REGISTERED_NAMES.exec(trimmedLine)
  if (registeredNames) {
    return [...(registeredNames[1] ?? '').matchAll(QUOTED_NAME)].map((match) => match[1] ?? '')
  }
  const destructuredNames = DESTRUCTURED_EXPORT.exec(trimmedLine)
  if (destructuredNames) {
    return splitNameList(destructuredNames[1] ?? '')
  }
  const declaredName = [DECLARATION, PROTOTYPE_ASSIGNMENT, METHOD_DEFINITION, OBJECT_KEY]
    .map((pattern) => pattern.exec(trimmedLine)?.[1])
    .find((name) => name !== undefined)
  return declaredName === undefined || STATEMENT_KEYWORDS.has(declaredName) ? [] : [declaredName]
}

const toFunctionDocumentation = (
  commentBody: string,
  codeLine: string
): StrudelFunctionDocumentation | null => {
  const documentationComment = readDocumentationComment(commentBody)
  if (documentationComment.tags.some((tag) => HIDDEN_TAGS.has(tag.title))) {
    return null
  }
  const declaredNames = namesDeclaredBy(codeLine)
  const taggedName = tagValues(documentationComment, 'name')[0]?.[0]?.trim()
  const name = taggedName ?? declaredNames[0]
  if (name === undefined || name.length === 0 || name.startsWith('_')) {
    return null
  }
  const taggedSynonyms = tagValues(documentationComment, 'synonyms').flatMap((lines) =>
    splitNameList(lines.join(' '))
  )
  return {
    name,
    synonyms: [...new Set([...taggedSynonyms, ...declaredNames])].filter(
      (synonym) => synonym !== name
    ),
    description: toParagraphs(documentationComment.descriptionLines),
    params: tagValues(documentationComment, 'param')
      .map(toParameter)
      .filter((parameter): parameter is StrudelFunctionParameter => parameter !== null),
    examples: tagValues(documentationComment, 'example')
      .map(toExample)
      .filter((example) => example.length > 0)
  }
}

/**
 * Reads the JSDoc comments of one Strudel source file into function docs, the way strudel.cc's
 * own reference is generated from the same comments.
 * @param sourceText - the text of one Strudel `.mjs` module
 * @returns a documentation entry per named comment, in source order, leaving out the ones hidden from completion
 */
export const parseStrudelDocumentation = (sourceText: string): StrudelFunctionDocumentation[] =>
  [...sourceText.matchAll(DOCUMENTATION_COMMENT_PATTERN)]
    .map((match) => toFunctionDocumentation(match[1] ?? '', match[2] ?? ''))
    .filter(
      (functionDocumentation): functionDocumentation is StrudelFunctionDocumentation =>
        functionDocumentation !== null
    )

const inlineWidgetDocumentations = (
  widgetSourceText: string,
  functionDocumentations: StrudelFunctionDocumentation[]
): StrudelFunctionDocumentation[] =>
  [...widgetSourceText.matchAll(REGISTERED_WIDGET)].map((match) => {
    const widgetName = match[1] ?? ''
    const drawnName = widgetName.slice(1)
    const drawnDocumentation = functionDocumentations.find(
      (functionDocumentation) =>
        functionDocumentation.name === drawnName ||
        functionDocumentation.synonyms.includes(drawnName)
    )
    return {
      name: widgetName,
      synonyms: [],
      description: [
        `Draws ${drawnName} under the line it is on.`,
        drawnDocumentation?.description ?? ''
      ]
        .filter((sentence) => sentence.length > 0)
        .join(' '),
      params: drawnDocumentation?.params ?? [],
      examples: drawnDocumentation?.examples ?? []
    }
  })

/**
 * Builds the completion docs for every documented Strudel function across its packages, plus
 * the underscore widgets that draw under their line.
 * @param sourceTexts - the `.mjs` sources of the Strudel packages, in a stable order
 * @param widgetSourceText - `@strudel/codemirror`'s widget module, which registers `_pianoroll` and the rest
 * @returns one entry per name, the first documented winning, sorted by name
 */
export const buildStrudelDocumentationIndex = (
  sourceTexts: string[],
  widgetSourceText: string
): StrudelFunctionDocumentation[] => {
  const documentedFunctions = sourceTexts
    .flatMap(parseStrudelDocumentation)
    .filter(
      (functionDocumentation, index, allDocumentations) =>
        allDocumentations.findIndex(
          (candidate) => candidate.name === functionDocumentation.name
        ) === index
    )
  return [
    ...documentedFunctions,
    ...inlineWidgetDocumentations(widgetSourceText, documentedFunctions)
  ]
    .filter(
      (functionDocumentation, index, allDocumentations) =>
        allDocumentations.findIndex(
          (candidate) => candidate.name === functionDocumentation.name
        ) === index
    )
    .sort((first, second) => first.name.localeCompare(second.name, 'en'))
}
