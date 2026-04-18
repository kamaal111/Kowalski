//
//  TransactionControls.swift
//  KowalskiFeatures
//

import KamaalUI
import SwiftUI

struct TransactionControls: View {
    @Binding var transactionType: TransactionType
    @Binding var transactionDate: Date

    let fixedTransactionType: TransactionType?

    var body: some View {
        HStack(spacing: 12) {
            Picker(
                selection: $transactionType,
                content: {
                    ForEach(TransactionType.allCases, id: \.self) { type in
                        Text(type.label)
                            .tag(type)
                    }
                },
                label: {
                    Text(transactionTypeAccessibilityLabel)
                },
            )
            .labelsHidden()
            .pickerStyle(.menu)
            .disabled(fixedTransactionType != nil)
            .accessibilityIdentifier(transactionTypeAccessibilityLabel)
            .accessibilityLabel(Text(transactionTypeAccessibilityLabel))
            DatePicker("", selection: $transactionDate, displayedComponents: .date)
                .labelsHidden()
                .fixedSize()
                .frame(minWidth: 150, alignment: .leading)
            Spacer(minLength: 0)
        }
        .padding(.vertical, .small)
        .ktakeWidthEagerly(alignment: .leading)
    }

    private var transactionTypeAccessibilityLabel: String {
        NSLocalizedString("Transaction Type", comment: "")
    }
}
