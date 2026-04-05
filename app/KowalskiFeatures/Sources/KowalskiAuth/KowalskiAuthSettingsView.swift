//
//  KowalskiAuthSettingsView.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/4/26.
//

import ForexKit
import KamaalUI
import KowalskiDesignSystem
import SwiftUI

public struct KowalskiAuthSettingsView: View {
    @Environment(KowalskiAuth.self) private var auth

    @State private var selectedCurrency: Currencies?
    @State private var isSaving = false
    @State private var toast: Toast?

    public init() {}

    public var body: some View {
        Form {
            Picker("Preferred Currency", selection: currencyBinding) {
                ForEach(Currencies.allCases, id: \.self) { currency in
                    Text(currency.rawValue)
                        .tag(currency)
                }
            }
            Button(action: handleSave) {
                if isSaving {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Text("Save")
                }
            }
            .disabled(!hasUnsavedChanges || isSaving)
        }
        .padding()
        .frame(minWidth: 300, minHeight: 150)
        .toastView(toast: $toast)
        .onAppear {
            selectedCurrency = auth.effectiveCurrency
        }
    }

    private var currencyBinding: Binding<Currencies> {
        Binding(
            get: { selectedCurrency ?? auth.effectiveCurrency },
            set: { selectedCurrency = $0 },
        )
    }

    private var hasUnsavedChanges: Bool {
        guard let selectedCurrency else { return false }

        return selectedCurrency != auth.effectiveCurrency
    }

    private func handleSave() {
        guard let selectedCurrency else { return }

        isSaving = true
        Task { @MainActor in
            let result = await auth.updatePreferredCurrency(selectedCurrency)
            isSaving = false

            switch result {
            case .success:
                toast = .success(
                    message: NSLocalizedString("Preferred currency saved.", bundle: .module, comment: ""),
                )
            case .failure:
                toast = .error(
                    message: NSLocalizedString("Failed to save preferred currency.", bundle: .module, comment: ""),
                )
            }
        }
    }
}

#Preview {
    KowalskiAuthSettingsView()
        .preview(withCredentials: true)
}
