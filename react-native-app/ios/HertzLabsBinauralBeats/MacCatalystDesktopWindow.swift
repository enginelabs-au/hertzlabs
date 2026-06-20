#if targetEnvironment(macCatalyst)
import UIKit

/// Keeps the UIKit window matched to the Mac Catalyst scene so React Native fills the desktop frame.
enum MacCatalystDesktopWindow {
    static let minWidth: CGFloat = 1024
    static let minHeight: CGFloat = 640
    static let preferredWidth: CGFloat = 1280
    static let preferredHeight: CGFloat = 800

    static let backgroundColor = UIColor(
        red: 15.0 / 255.0,
        green: 14.0 / 255.0,
        blue: 23.0 / 255.0,
        alpha: 1.0
    )

    private static var frameSync: MacWindowFrameSync?

    static func makeWindow() -> UIWindow {
        let bounds = UIScreen.main.bounds
        let window: UIWindow
        if let scene = activeScene() {
            window = UIWindow(windowScene: scene)
            window.frame = sceneBounds(scene)
        } else {
            window = UIWindow(frame: bounds)
        }
        window.backgroundColor = backgroundColor
        return window
    }

    static func configure(_ window: UIWindow?) {
        guard let window else { return }
        window.backgroundColor = backgroundColor
        applySizeRestrictions(to: window.windowScene)
        syncFrame(to: window)

        frameSync?.stop()
        frameSync = MacWindowFrameSync(window: window)
        frameSync?.start()
    }

    static func syncFrame(to window: UIWindow?) {
        guard let window, let scene = window.windowScene else { return }
        let bounds = sceneBounds(scene)
        guard bounds.width > 0, bounds.height > 0 else { return }
        if window.frame.size != bounds.size || window.frame.origin != bounds.origin {
            window.frame = bounds
        }
    }

    private static func activeScene() -> UIWindowScene? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive || $0.activationState == .foregroundInactive }
            ?? UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
    }

    private static func sceneBounds(_ scene: UIWindowScene) -> CGRect {
        scene.coordinateSpace.bounds
    }

    private static func applySizeRestrictions(to scene: UIWindowScene?) {
        scene?.sizeRestrictions?.minimumSize = CGSize(width: minWidth, height: minHeight)
    }
}

private final class MacWindowFrameSync {
    private weak var window: UIWindow?
    private var timer: Timer?

    init(window: UIWindow) {
        self.window = window
    }

    func start() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { [weak self] _ in
            MacCatalystDesktopWindow.syncFrame(to: self?.window)
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    deinit {
        stop()
    }
}
#endif
