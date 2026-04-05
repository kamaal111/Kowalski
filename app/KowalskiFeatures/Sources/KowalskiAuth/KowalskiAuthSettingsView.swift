//
//  KowalskiAuthSettingsView.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/4/26.
//

import ForexKit
import KowalskiDesignSystem
import SwiftUI

public struct KowalskiAuthSettingsView: View {
    @Environment(KowalskiAuth.self) private var auth

    @State private var selectedPane: KowalskiAuthSettingsPane = .general
    @State private var persistedCurrency: Currencies = .USD
    @State private var selectedCurrency: Currencies = .USD
    @State private var isSaving = false
    @State private var toast: Toast?

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            settingsTabs
            Divider()
            ZStack {
                switch selectedPane {
                case .general:
                    generalSettingsPane
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
    }

    private var settingsTabs: some View {
        HStack(spacing: 20) {
            ForEach(KowalskiAuthSettingsPane.allCases) { pane in
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

    private func syncPersistedCurrency(_ currency: Currencies) {
        persistedCurrency = currency
        guard !isSaving else { return }

        selectedCurrency = currency
    }

    private func finishSavingSuccessfully(with currency: Currencies) {
        isSaving = false
        persistedCurrency = currency
        selectedCurrency = currency
    }

    private func finishSavingWithFailure() {
        isSaving = false
        selectedCurrency = persistedCurrency
        toast = .error(message: Self.failedToSavePreferredCurrencyMessage)
    }

    private static let failedToSavePreferredCurrencyMessage = NSLocalizedString(
        "Failed to save preferred currency.",
        bundle: .module,
        comment: "",
    )
}

private enum KowalskiAuthSettingsPane: String, CaseIterable, Identifiable {
    case general

    var id: Self {
        self
    }

    var title: LocalizedStringResource {
        switch self {
        case .general: "General"
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
