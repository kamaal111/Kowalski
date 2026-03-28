//
//  ToastView.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 10/12/25.
//

import SwiftUI

struct ToastView: View {
    var style: ToastStyle
    var message: String
    var width: CGFloat
    var onCancelTapped: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: style.imageSystemName)
                .foregroundColor(style.color)
            Text(message)
                .font(.caption)
                .foregroundColor(.toastForeground)
            Spacer(minLength: 10)
            Button(action: onCancelTapped) {
                Image(systemName: "xmark")
                    .foregroundColor(style.color)
            }
        }
        .padding()
        .frame(minWidth: 0, maxWidth: width)
        .background(Color.toastBackground)
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(style.color, lineWidth: 1)
                .opacity(0.6),
        )
        .padding(.horizontal, 16)
    }
}

#Preview {
    ZStack {
        Color.black
        ToastView(style: .success, message: "Very nice, very well!", width: .infinity) {}
    }
    .padding(.all, .medium)
    .frame(width: 500, height: 200)
    .environment(\.colorScheme, .light)
}
