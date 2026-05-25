//
//  KowalskiPortfolioDashboardStatusView.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/25/26.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioDashboardStatusView: View {
    let status: KowalskiPortfolioDashboardStatus

    var body: some View {
        VStack(spacing: status.spacing) {
            if status == .loading {
                ProgressView()
                    .controlSize(.large)
            }
            Text(status.title, bundle: .module)
                .font(status.titleFont)
                .foregroundStyle(status.titleColor)

            if let subtitle = status.subtitle {
                Text(subtitle, bundle: .module)
                    .foregroundStyle(.secondary)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, minHeight: 280, alignment: .center)
    }
}

enum KowalskiPortfolioDashboardStatus {
    case loading
    case empty
    case error

    var title: LocalizedStringKey {
        switch self {
        case .loading:
            "Loading dashboards"
        case .empty:
            "No dashboard data yet"
        case .error:
            "Dashboard unavailable"
        }
    }

    var subtitle: LocalizedStringKey? {
        switch self {
        case .loading:
            nil
        case .empty:
            "Portfolio growth will appear after transactions are available."
        case .error:
            "Try again later."
        }
    }

    var spacing: CGFloat {
        switch self {
        case .loading:
            KowalskiSizes.medium.rawValue
        case .empty, .error:
            KowalskiSizes.small.rawValue
        }
    }

    var titleFont: Font {
        switch self {
        case .loading:
            .headline
        case .empty, .error:
            .title3
        }
    }

    var titleColor: Color {
        switch self {
        case .loading:
            .secondary
        case .empty, .error:
            .primary
        }
    }
}
