//
//  KowalskiAuthSettingsView.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/4/26.
//

import ForexKit
import KowalskiDesignSystem
import KowalskiFeaturesConfig
import KowalskiUtils
import SwiftUI
import UniformTypeIdentifiers

public typealias KowalskiAuthSettingsExportAction = () async -> Result<URL, any Error>
public typealias KowalskiAuthSettingsImportAction = (URL) async -> Result<Void, any Error>

public struct KowalskiAuthSettingsView: View {
    @Environment(KowalskiAuth.self) private var auth

    @State private var selectedPane: KowalskiAuthSettingsPane = .general
    @State private var persistedCurrency: Currencies = KowalskiFeatureDefaults.fallbackCurrency
    @State private var selectedCurrency: Currencies = KowalskiFeatureDefaults.fallbackCurrency
    @State private var isSaving = false
    @State private var isShowingImportSheet = false
    @State private var isShowingFileImporter = false
    @State private var toast: Toast?

    private let onExportTransactions: KowalskiAuthSettingsExportAction?
    private let onImportTransactions: KowalskiAuthSettingsImportAction?
    private let onDownloadTransactionsTemplate: KowalskiAuthSettingsExportAction?

    public init(
        onExportTransactions: KowalskiAuthSettingsExportAction? = nil,
        onImportTransactions: KowalskiAuthSettingsImportAction? = nil,
        onDownloadTransactionsTemplate: KowalskiAuthSettingsExportAction? = nil,
    ) {
        self.onExportTransactions = onExportTransactions
        self.onImportTransactions = onImportTransactions
        self.onDownloadTransactionsTemplate = onDownloadTransactionsTemplate
    }

    public var body: some View {
        VStack(spacing: 0) {
            settingsTabs
            Divider()
            ZStack {
                switch selectedPane {
                case .general:
                    generalSettingsPane
                case .data:
                    dataSettingsPane
                }

                if isSaving {
                    ProgressView()
                        .controlSize(.regular)
                }
            }
        }
        .disabled(isSaving)
        .toastView(toast: $toast)
        .frame(width: 500, height: 400, alignment: .topLeading)
        .onAppear { syncPersistedCurrency(auth.effectiveCurrency) }
        .onChange(of: auth.effectiveCurrency) { _, currency in
            syncPersistedCurrency(currency)
        }
        .fileImporter(
            isPresented: $isShowingFileImporter,
            allowedContentTypes: [.commaSeparatedText, .plainText],
            allowsMultipleSelection: false,
        ) { result in
            handleImportedFileSelection(result)
        }
        .sheet(isPresented: $isShowingImportSheet) {
            importTransactionsSheet
        }
    }

    private var settingsTabs: some View {
        HStack(spacing: 20) {
            ForEach(availablePanes) { pane in
                Button(action: { selectedPane = pane }) {
                    VStack(spacing: 8) {
                        Text(pane.title)
                            .font(.headline)
                            .foregroundStyle(selectedPane == pane ? Color.primary : Color.secondary)
                        Rectangle()
                            .fill(selectedPane == pane ? Color.accentColor : Color.clear)
                            .frame(height: 2)
                    }
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, .large)
        .padding(.vertical, .medium)
    }

    private var availablePanes: [KowalskiAuthSettingsPane] {
        hasDataCallbacks ? [.general, .data] : [.general]
    }

    private var generalSettingsPane: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 6) {
                Text("General")
                    .font(.title2.weight(.semibold))
                Text("Choose how Kowalski behaves by default.")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, .large)
            .padding(.top, .large)
            .padding(.bottom, .medium)

            Divider()

            VStack(spacing: 0) {
                SettingsRow(
                    title: NSLocalizedString("Preferred Currency", bundle: .module, comment: ""),
                    subtitle: NSLocalizedString(
                        "Used as the default currency for new transactions.",
                        bundle: .module,
                        comment: "",
                    ),
                ) {
                    Picker(
                        NSLocalizedString("Preferred Currency", bundle: .module, comment: ""),
                        selection: currencyBinding,
                    ) {
                        ForEach(Currencies.allCases, id: \.self) { currency in
                            Text(currency.rawValue)
                                .tag(currency)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .frame(width: 160, alignment: .trailing)
                }
            }
            .padding(.horizontal, .large)

            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private var dataSettingsPane: some View {
        if hasDataCallbacks {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Data")
                        .font(.title2.weight(.semibold))
                    Text("Export your transactions to CSV or import a backup.")
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, .large)
                .padding(.top, .large)
                .padding(.bottom, .medium)

                Divider()

                VStack(spacing: 0) {
                    SettingsRow(
                        title: NSLocalizedString("Export Transactions", bundle: .module, comment: ""),
                        subtitle: NSLocalizedString(
                            "Create a CSV backup of your portfolio transactions.",
                            bundle: .module,
                            comment: "",
                        ),
                    ) {
                        Button("Export") {
                            handleExportTransactions()
                        }
                        .disabled(isSaving)
                    }

                    Divider()

                    SettingsRow(
                        title: NSLocalizedString("Import Transactions", bundle: .module, comment: ""),
                        subtitle: NSLocalizedString(
                            "Restore transactions from a CSV export or template file.",
                            bundle: .module,
                            comment: "",
                        ),
                    ) {
                        Button("Import") {
                            isShowingImportSheet = true
                        }
                        .disabled(isSaving)
                    }
                }
                .padding(.horizontal, .large)

                Spacer(minLength: 0)
            }
        }
    }

    private var importTransactionsSheet: some View {
        VStack(alignment: .leading, spacing: KowalskiSizes.large.rawValue) {
            Text("Import Transactions")
                .font(.title2.weight(.semibold))
            Text(
                "Use the CSV export format to restore transactions. "
                    + "Rows with malformed values are skipped during import.",
            )
            .foregroundStyle(.secondary)

            HStack {
                Button("Download CSV Template") {
                    handleDownloadTransactionsTemplate()
                }
                .disabled(isSaving)

                Spacer(minLength: 0)

                Button("Choose File…") {
                    handleChooseImportFile()
                }
                .disabled(isSaving)
            }

            Spacer(minLength: 0)
        }
        .padding(KowalskiSizes.large.rawValue)
        .frame(width: 420, height: 220, alignment: .topLeading)
    }

    private var currencyBinding: Binding<Currencies> {
        Binding(
            get: { selectedCurrency },
            set: { currency in
                guard !isSaving else { return }

                selectedCurrency = currency
                guard currency != persistedCurrency else { return }

                toast = nil
                isSaving = true

                Task { @MainActor in
                    let result = await auth.updatePreferredCurrency(currency)

                    switch result {
                    case .success:
                        finishSavingSuccessfully(with: auth.effectiveCurrency)
                    case .failure:
                        finishSavingWithFailure()
                    }
                }
            },
        )
    }

    private var hasDataCallbacks: Bool {
        onExportTransactions != nil && onImportTransactions != nil && onDownloadTransactionsTemplate != nil
    }
}

private extension KowalskiAuthSettingsView {
    func syncPersistedCurrency(_ currency: Currencies) {
        persistedCurrency = currency
        guard !isSaving else { return }

        selectedCurrency = currency
    }

    func finishSavingSuccessfully(with currency: Currencies) {
        isSaving = false
        persistedCurrency = currency
        selectedCurrency = currency
    }

    func finishSavingWithFailure() {
        isSaving = false
        selectedCurrency = persistedCurrency
        toast = .error(message: Self.failedToSavePreferredCurrencyMessage)
    }

    func handleExportTransactions() {
        guard let onExportTransactions else { return }

        toast = nil
        isSaving = true
        Task { @MainActor in
            let result = await onExportTransactions()
            isSaving = false

            switch result {
            case let .success(url):
                persistExportedFileIfPossible(url, successMessage: Self.transactionsExportedMessage)
            case let .failure(error):
                toast = .error(message: error.localizedDescription)
            }
        }
    }

    func handleDownloadTransactionsTemplate() {
        guard let onDownloadTransactionsTemplate else { return }

        isShowingImportSheet = false
        toast = nil
        isSaving = true
        Task { @MainActor in
            await Task.yield()
            let result = await onDownloadTransactionsTemplate()
            isSaving = false

            switch result {
            case let .success(url):
                persistExportedFileIfPossible(url, successMessage: Self.transactionsTemplateDownloadedMessage)
            case let .failure(error):
                toast = .error(message: error.localizedDescription)
            }
        }
    }

    func handleChooseImportFile() {
        isShowingImportSheet = false

        #if os(macOS)
            Task { @MainActor in
                await Task.yield()
                guard let url = MacOSFilePanels.chooseFileURL(contentTypes: [.commaSeparatedText, .plainText])
                else { return }

                handleImportTransactions(from: url)
            }
        #else
            isShowingFileImporter = true
        #endif
    }

    func handleImportedFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case let .failure(error):
            toast = .error(message: error.localizedDescription)
        case let .success(urls):
            guard let url = urls.first else { return }

            handleImportTransactions(from: url)
        }
    }

    func handleImportTransactions(from url: URL) {
        guard let onImportTransactions else { return }

        toast = nil
        isSaving = true
        Task { @MainActor in
            let result = await onImportTransactions(url)
            isSaving = false

            switch result {
            case .success:
                toast = .success(message: Self.transactionsImportedMessage)
            case let .failure(error):
                toast = .error(message: error.localizedDescription)
            }
        }
    }

    func persistExportedFileIfPossible(_ temporaryURL: URL, successMessage: String) {
        #if os(macOS)
            do {
                let wasSaved = try MacOSFilePanels.saveTemporaryFile(
                    at: temporaryURL,
                    contentTypes: [.commaSeparatedText],
                )
                guard wasSaved else { return }

                toast = .success(message: successMessage)
            } catch {
                toast = .error(message: error.localizedDescription)
            }
        #else
            _ = temporaryURL
            toast = .success(message: successMessage)
        #endif
    }

    static let failedToSavePreferredCurrencyMessage = NSLocalizedString(
        "Failed to save preferred currency.",
        bundle: .module,
        comment: "",
    )
    static let transactionsExportedMessage = NSLocalizedString(
        "Transactions exported.",
        bundle: .module,
        comment: "",
    )
    static let transactionsImportedMessage = NSLocalizedString(
        "Transactions imported.",
        bundle: .module,
        comment: "",
    )
    static let transactionsTemplateDownloadedMessage = NSLocalizedString(
        "CSV template downloaded.",
        bundle: .module,
        comment: "",
    )
}

private enum KowalskiAuthSettingsPane: String, CaseIterable, Identifiable {
    case general
    case data

    var id: Self {
        self
    }

    var title: LocalizedStringResource {
        switch self {
        case .general: "General"
        case .data: "Data"
        }
    }
}

private struct SettingsRow<Content: View>: View {
    let title: String
    let subtitle: String
    private let content: Content

    init(title: String, subtitle: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 32) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.body.weight(.medium))
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            content
        }
        .padding(.vertical, .medium)
    }
}

#Preview {
    KowalskiAuthSettingsView()
        .preview(withCredentials: true)
}
