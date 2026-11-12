import React from "react"
import parse, {
  attributesToProps,
  Element,
  type HTMLReactParserOptions,
} from "html-react-parser"
import Script, { type ScriptProps } from "next/script"

const supportedHeadElements = new Set([
  "base",
  "link",
  "meta",
  "noscript",
  "style",
  "title",
])

type HeadSlot = "head-start" | "head-end"

export function renderHeadCustomCode(
  html: string | undefined,
  slot: HeadSlot,
): React.ReactNode {
  if (!html) return null

  let scriptIndex = 0
  const options: HTMLReactParserOptions = {
    replace(domNode) {
      if (domNode instanceof Element && domNode.name === "script") {
        const props = attributesToProps(domNode.attribs) as ScriptProps
        const id = props.id || `figma-custom-code-${slot}-${scriptIndex}`
        scriptIndex += 1
        const contents = domNode.children
          .map((child) => (child.type === "text" ? child.data : ""))
          .join("")
        const scriptContents = contents.trim() ? contents : undefined

        return (
          <Script {...props} id={id} strategy="afterInteractive">
            {scriptContents}
          </Script>
        )
      }

      if (domNode.parent && domNode.parent.type !== "root") return
      if (
        domNode instanceof Element &&
        supportedHeadElements.has(domNode.name)
      ) {
        return
      }

      // Head custom code can contain whitespace, comments, or body-only HTML.
      // Only elements React and HTML support in <head> are rendered here.
      return <React.Fragment />
    },
  }

  return parse(html, options)
}

export function BodyCustomCode({ html }: { html: string | undefined }) {
  if (!html) return null
  const contents = { __html: html }

  return (
    <div
      className="figma-custom-code-fragment"
      suppressHydrationWarning
      dangerouslySetInnerHTML={contents}
    />
  )
}
