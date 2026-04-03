//
//  KowalskiPortfolioTransactionScreen.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/2/25.
//

import KamaalUI
import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioTransactionScreen: View {
    @Environment(KowalskiPortfolio.self) private var portfolio
    @Environment(\.dismiss) private var dismiss

    @State private var toast: Toast?

    let onTransactionAdd: (_ formPayload: TransactionPayload) -> Void

    var body: some View {
        KFormBox(title: NSLocalizedString("Add Entry", comment: ""), minSize: ModuleConfig.screenMinSize) {
            VStack {
                KowalskiPortfolioTransactionEditor(
                    initialValues: .empty,
                    autofocusAmountField: false,
                    submitButtonTitle: "Add Transaction",
                    onSubmit: { payload in
                        await portfolio.storeTransaction(payload).mapError { error in error as Error }
                    },
                    onFailure: { error in
                        toast = .error(message: error.localizedDescription)
                    },
                    onSuccess: { _, payload in
                        dismiss()
                        onTransactionAdd(payload)
                    },
                )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("Add Transaction")
        .toastView(toast: $toast)
    }
}

#Preview("Transaction") {
    NavigationStack {
        KowalskiPortfolioTransactionScreen(onTransactionAdd: { _ in })
    }
    .preview()
}
