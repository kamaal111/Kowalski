//
//  SubmitButton.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/26/25.
//

import SwiftUI

struct SubmitButton: View {
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        VStack {
            Button(action: action) {
                Text("Continue")
                    .bold()
                    .foregroundStyle(!disabled ? Color.accentColor : Color.secondary)
            }
            .buttonStyle(.plain)
            .disabled(disabled)
        }
    }
}

#Preview {
    SubmitButton(disabled: false, action: { })
}
