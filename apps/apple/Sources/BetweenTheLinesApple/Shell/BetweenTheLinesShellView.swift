import SwiftUI

public struct BetweenTheLinesShellView: View {
    @State private var document: DiffDocument
    private let telemetry: TelemetryClient

    public init(
        document: DiffDocument = .sample,
        telemetry: TelemetryClient = NoOpTelemetryClient()
    ) {
        _document = State(initialValue: document)
        self.telemetry = telemetry
    }

    public var body: some View {
        NavigationSplitView {
            sidebar
        } detail: {
            DiffWebView(document: document, telemetry: telemetry)
                .navigationTitle(document.title)
                #if os(macOS)
                .toolbar {
                    ToolbarItemGroup {
                        Button("Export") {
                            telemetry.track(
                                TelemetryEvent(
                                    name: .exportRequested,
                                    properties: document.stats.telemetryProperties
                                )
                            )
                        }

                        Toggle("Line Numbers", isOn: lineNumbers)
                    }
                }
                #endif
        }
        .onAppear {
            telemetry.track(
                TelemetryEvent(
                    name: .appOpened,
                    properties: document.stats.telemetryProperties
                )
            )
        }
    }

    private var sidebar: some View {
        List {
            Section("Document") {
                Label(document.title, systemImage: "doc.text.magnifyingglass")
                LabeledContent("Files", value: "\(document.stats.files)")
                LabeledContent("Added", value: "+\(document.stats.additions)")
                LabeledContent("Deleted", value: "-\(document.stats.deletions)")
            }

            Section("Settings") {
                Picker("Layout", selection: diffStyle) {
                    Text("Split").tag(DiffStyle.split)
                    Text("Unified").tag(DiffStyle.unified)
                }

                Toggle("Line Numbers", isOn: lineNumbers)
            }

            Section("Annotations") {
                if document.annotations.isEmpty {
                    Text("No annotations")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(document.annotations) { annotation in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(annotation.side.rawValue) line \(annotation.lineNumber)")
                                .font(.headline)
                            Text(annotation.note)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Between the Lines")
    }

    private var diffStyle: Binding<DiffStyle> {
        Binding {
            document.settings.diffStyle
        } set: { newValue in
            document.settings.diffStyle = newValue
            document.updatedAt = Date()
            telemetry.track(TelemetryEvent(name: .settingsChanged, properties: ["setting": "diff_style"]))
        }
    }

    private var lineNumbers: Binding<Bool> {
        Binding {
            document.settings.lineNumbers
        } set: { newValue in
            document.settings.lineNumbers = newValue
            document.updatedAt = Date()
            telemetry.track(TelemetryEvent(name: .settingsChanged, properties: ["setting": "line_numbers"]))
        }
    }
}
