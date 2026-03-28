//
//  KowalskiSizes.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 10/5/25.
//

import SwiftUI

/// Set app sizes.
public enum KowalskiSizes: CGFloat {
    /// Size of 0
    case nada = 0
    /// Size of 2
    case extraExtraSmall = 2
    /// Size of 4
    case extraSmall = 4
    /// Size of 8
    case small = 8
    /// Size of 16
    case medium = 16
    /// Size of 24
    case large = 24
    /// Size of 32
    case extraLarge = 32

    public static func + (lhs: CGFloat, rhs: KowalskiSizes) -> CGFloat {
        lhs + rhs.rawValue
    }

    public static func + (lhs: KowalskiSizes, rhs: CGFloat) -> CGFloat {
        lhs.rawValue + rhs
    }
}

public extension View {
    /// Set padding to the view with set ``AppSizes``.
    /// - Parameters:
    ///   - edges: Which edge or edges to set the padding to.
    ///   - length: The length of padding to set the view edge to.
    /// - Returns: The view with updated padding.
    func padding(_ edges: Edge.Set = .all, _ length: KowalskiSizes) -> some View {
        padding(edges, length.rawValue)
    }

    /// Set corner radius to the view with set ``AppSizes``.
    /// - Parameter length: The length of corner radius to set on the view.
    /// - Returns: The view with updated corner radius.
    func cornerRadius(_ length: KowalskiSizes) -> some View {
        cornerRadius(length.rawValue)
    }
}
