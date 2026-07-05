import Foundation

public struct DiffHTMLRenderer: Sendable {
    public init() {}

    public func render(_ document: DiffDocument) -> String {
        let body = switch document.source {
        case .filePair(let oldFile, let newFile):
            renderFilePair(oldFile: oldFile, newFile: newFile)
        case .patch(let patch):
            renderPatch(patch)
        }

        return """
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              color-scheme: light dark;
              font: -apple-system-body;
              --added: rgba(15, 139, 99, 0.18);
              --removed: rgba(188, 61, 81, 0.16);
              --line: rgba(127, 127, 127, 0.22);
            }

            body {
              margin: 0;
              padding: 20px;
              background: Canvas;
              color: CanvasText;
            }

            header {
              display: flex;
              justify-content: space-between;
              gap: 16px;
              margin-bottom: 18px;
            }

            h1 {
              font-size: 24px;
              line-height: 1.2;
              margin: 0;
            }

            .labels {
              color: GrayText;
              font-size: 13px;
              white-space: nowrap;
            }

            section {
              border: 1px solid var(--line);
              border-radius: 8px;
              margin-bottom: 14px;
              overflow: hidden;
            }

            h2 {
              font-size: 13px;
              margin: 0;
              padding: 10px 12px;
              border-bottom: 1px solid var(--line);
              background: rgba(127, 127, 127, 0.08);
            }

            table {
              border-collapse: collapse;
              width: 100%;
              font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
              font-size: 13px;
            }

            td {
              border-bottom: 1px solid var(--line);
              padding: 7px 10px;
              vertical-align: top;
              white-space: pre-wrap;
              word-break: break-word;
            }

            tr:last-child td {
              border-bottom: none;
            }

            .number {
              color: GrayText;
              text-align: right;
              width: 44px;
              user-select: none;
            }

            .added {
              background: var(--added);
            }

            .removed {
              background: var(--removed);
            }
          </style>
        </head>
        <body>
          <header>
            <h1>\(document.title.htmlEscaped)</h1>
            <div class="labels">\(document.stats.additions) added / \(document.stats.deletions) deleted</div>
          </header>
          \(body)
        </body>
        </html>
        """
    }

    private func renderFilePair(oldFile: DiffFileVersion, newFile: DiffFileVersion) -> String {
        let oldRows = oldFile.contents
            .split(separator: "\n", omittingEmptySubsequences: false)
            .enumerated()
            .map { renderLine(number: $0.offset + 1, className: "removed", text: String($0.element)) }
            .joined(separator: "\n")
        let newRows = newFile.contents
            .split(separator: "\n", omittingEmptySubsequences: false)
            .enumerated()
            .map { renderLine(number: $0.offset + 1, className: "added", text: String($0.element)) }
            .joined(separator: "\n")

        return """
        <section>
          <h2>\(oldFile.name.htmlEscaped)</h2>
          <table><tbody>\(oldRows)</tbody></table>
        </section>
        <section>
          <h2>\(newFile.name.htmlEscaped)</h2>
          <table><tbody>\(newRows)</tbody></table>
        </section>
        """
    }

    private func renderPatch(_ patch: String) -> String {
        let rows = patch
            .split(separator: "\n", omittingEmptySubsequences: false)
            .enumerated()
            .map { index, line in
                let className = if line.hasPrefix("+") && !line.hasPrefix("+++") {
                    "added"
                } else if line.hasPrefix("-") && !line.hasPrefix("---") {
                    "removed"
                } else {
                    ""
                }

                return renderLine(number: index + 1, className: className, text: String(line))
            }
            .joined(separator: "\n")

        return """
        <section>
          <h2>Unified patch</h2>
          <table><tbody>\(rows)</tbody></table>
        </section>
        """
    }

    private func renderLine(number: Int, className: String, text: String) -> String {
        """
        <tr class="\(className)">
          <td class="number">\(number)</td>
          <td>\(text.htmlEscaped)</td>
        </tr>
        """
    }
}

private extension String {
    var htmlEscaped: String {
        var escaped = self
        escaped = escaped.replacingOccurrences(of: "&", with: "&amp;")
        escaped = escaped.replacingOccurrences(of: "<", with: "&lt;")
        escaped = escaped.replacingOccurrences(of: ">", with: "&gt;")
        escaped = escaped.replacingOccurrences(of: "\"", with: "&quot;")
        escaped = escaped.replacingOccurrences(of: "'", with: "&#39;")
        return escaped
    }
}
