//
//  View+Extensions.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 11/1/25.
//

import SwiftUI

extension View {
    public func frame(minSize size: CGSize) -> some View {
        self
            .frame(minWidth: size.width, minHeight: size.height)
    }
}
