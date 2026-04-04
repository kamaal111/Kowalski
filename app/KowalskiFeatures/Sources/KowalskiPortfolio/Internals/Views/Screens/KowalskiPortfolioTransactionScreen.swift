//
//  KowalskiPortfolioTransactionScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/2/25.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioTransactionScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio
    @Environment(\.dismiss) private var dismiss

    @State private var toast: Toast?

    let initialValues: KowalskiPortfolioTransactionFormValues
    let editorConfiguration: KowalskiPortfolioTransactionEditorConfiguration
    let onTransactionAdd: (_ formPayload: TransactionPayload) -> Void

    init(
        initialValues: KowalskiPortfolioTransactionFormValues = .empty,
        editorConfiguration: KowalskiPortfolioTransactionEditorConfiguration = .default,
        onTransactionAdd: @escaping (_ formPayload: TransactionPayload) -> Void = { _ in },
    ) {
        self.initialValues = initialValues
        self.editorConfiguration = editorConfiguration
        self.onTransactionAdd = onTransactionAdd
    }

    var body: some View {
        ScrollView {
            KowalskiPortfolioTransactionEditor(
                initialValues: initialValues,
                autofocusAmountField: false,
                configuration: editorConfiguration,
                submitButtonTitle: "Add Transaction",
                onSubmit: { payload in
                    await portfolio.storeTransaction(payload).mapError { error in error as Error }
                },
                onFailure: { error in
                    toast = .error(message: error.localizedDescription)
                },
                onSuccess: { _, payload in
                    onTransactionAdd(payload)
                    dismiss()
                },
            )
            .padding(.horizontal, .medium)
            .padding(.vertical, .small)
        }
        .frame(minSize: ModuleConfig.screenMinSize)
        .navigationTitle(screenTitle)
        .toastView(toast: $toast)
    }

    private var screenTitle: LocalizedStringResource {
        switch editorConfiguration.fixedTransactionType {
        case .purchase: "Buy Transaction"
        case .sell: "Sell Transaction"
        case .split, nil: "Add Transaction"
        }
    }
}

#Preview("Transaction") {
    NavigationStack {
        KowalskiPortfolioTransactionScreen(onTransactionAdd: { _ in })
    }
    .preview()
}
