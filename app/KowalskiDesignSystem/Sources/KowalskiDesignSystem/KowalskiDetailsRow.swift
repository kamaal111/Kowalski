//
//  KowalskiDetailsRow.swift
//  KowalskiDesignSystem
//
//  Created by OpenAI Codex on 5/24/26.
//

import SwiftUI

public struct KowalskiDetailsRow: View {
    let title: LocalizedStringKey
    let subtitle: String?
    let detailTitle: LocalizedStringKey?
    let detailValue: String
    let footer: String?
    let detailValueAccessibilityIdentifier: String
    let accessibilityLabel: String?

    public init(
        title: LocalizedStringKey,
        subtitle: String? = nil,
        detailTitle: LocalizedStringKey? = nil,
        detailValue: String,
        footer: String? = nil,
        detailValueAccessibilityIdentifier: String = "",
        accessibilityLabel: String? = nil,
    ) {
        self.title = title
        self.subtitle = subtitle
        self.detailTitle = detailTitle
        self.detailValue = detailValue
        self.footer = footer
        self.detailValueAccessibilityIdentifier = detailValueAccessibilityIdentifier
        self.accessibilityLabel = accessibilityLabel
    }

    public var body: some View {
        if let accessibilityLabel {
            rowContent
                .accessibilityElement(children: .combine)
                .accessibilityLabel(Text(accessibilityLabel))
        } else {
            rowContent
        }
    }

    private var rowContent: some View {
        VStack(alignment: .leading, spacing: rowSpacing) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(titleFont)
                    .foregroundStyle(titleForegroundStyle)
                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            HStack(alignment: detailTitle == nil ? .top : .firstTextBaseline, spacing: 12) {
                if let detailTitle {
                    Text(detailTitle)
                }
                Spacer()
                Text(detailValue)
                    .multilineTextAlignment(.trailing)
                    .accessibilityIdentifier(detailValueAccessibilityIdentifier)
            }
            .font(detailFont)
            .foregroundStyle(detailForegroundStyle)
            if let footer {
                Text(footer)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, isDetailOnly ? 0 : KowalskiSizes.extraSmall.rawValue)
    }

    private var isDetailOnly: Bool {
        subtitle == nil && detailTitle == nil && footer == nil
    }

    private var rowSpacing: CGFloat {
        isDetailOnly ? 0 : 8
    }

    private var titleFont: Font {
        isDetailOnly ? .body : .headline
    }

    private var titleForegroundStyle: some ShapeStyle {
        isDetailOnly ? .secondary : .primary
    }

    private var detailFont: Font {
        isDetailOnly ? .body : .subheadline
    }

    private var detailForegroundStyle: some ShapeStyle {
        isDetailOnly ? .primary : .secondary
    }
}

public extension KowalskiDetailsRow {
    init(
        detailTitle title: LocalizedStringKey,
        value: String,
        valueAccessibilityIdentifier: String = "",
    ) {
        self.init(
            title: title,
            detailValue: value,
            detailValueAccessibilityIdentifier: valueAccessibilityIdentifier,
        )
    }
}
