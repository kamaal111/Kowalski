//
//  Preview.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/12/25.
//

import SwiftUI

extension View {
    func preview(withCredentials: Bool) -> some View {
        let auth = KowalskiAuth.preview(withCredentials: withCredentials)

        return kowalskiAuth(auth)
    }
}
