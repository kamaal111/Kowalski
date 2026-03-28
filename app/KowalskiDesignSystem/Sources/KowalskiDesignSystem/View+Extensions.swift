//
//  View+Extensions.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 11/1/25.
//

import SwiftUI

public extension View {
    func frame(minSize size: CGSize) -> some View {
        frame(minWidth: size.width, minHeight: size.height)
    }
}
