import Foundation
import UIKit
import Capacitor
import CoreMIDI
import CoreAudioKit
import UniformTypeIdentifiers

/// Ponte entre o MIDI nativo da Apple (CoreMIDI) e o app web.
/// Escuta todos os teclados conectados (USB, Bluetooth, rede) e envia as notas para o JavaScript.
@objc(MidiPlugin)
public class MidiPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MidiPlugin"
    public let jsName = "Midi"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listDevices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBluetooth", returnType: CAPPluginReturnPromise),
    ]

    private var client = MIDIClientRef()
    private var port = MIDIPortRef()
    private var started = false
    private var connected = Set<MIDIUniqueID>()

    @objc func start(_ call: CAPPluginCall) {
        if started {
            call.resolve(["devices": devices()])
            return
        }
        var status = MIDIClientCreateWithBlock("PianoEstudio" as CFString, &client) { [weak self] notification in
            let id = notification.pointee.messageID
            guard id == .msgSetupChanged || id == .msgObjectAdded || id == .msgObjectRemoved else { return }
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.connectAll()
                self.notifyListeners("devices", data: ["devices": self.devices()])
            }
        }
        guard status == noErr else {
            call.reject("Não consegui iniciar o MIDI (erro \(status)).")
            return
        }
        status = MIDIInputPortCreateWithProtocol(client, "Entrada" as CFString, ._1_0, &port) { [weak self] list, _ in
            self?.handle(list)
        }
        guard status == noErr else {
            call.reject("Não consegui abrir a entrada MIDI (erro \(status)).")
            return
        }
        started = true
        connectAll()
        call.resolve(["devices": devices()])
    }

    @objc func listDevices(_ call: CAPPluginCall) {
        // Também reconecta: se um teclado entrou sem aviso do sistema, ele passa a ser ouvido aqui.
        DispatchQueue.main.async {
            if self.started { self.connectAll() }
            call.resolve(["devices": self.devices()])
        }
    }

    /// Abre a tela da Apple para parear teclados MIDI por Bluetooth.
    @objc func showBluetooth(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let central = CABTMIDICentralViewController()
            let nav = UINavigationController(rootViewController: central)
            central.navigationItem.rightBarButtonItem = UIBarButtonItem(
                barButtonSystemItem: .done, target: self, action: #selector(self.closeBluetooth))
            nav.modalPresentationStyle = .formSheet
            self.bridge?.viewController?.present(nav, animated: true)
            call.resolve()
        }
    }

    @objc private func closeBluetooth() {
        bridge?.viewController?.dismiss(animated: true)
    }

    // MARK: - Fontes

    private func connectAll() {
        var present = Set<MIDIUniqueID>()
        for i in 0..<MIDIGetNumberOfSources() {
            var uid: MIDIUniqueID = 0
            MIDIObjectGetIntegerProperty(MIDIGetSource(i), kMIDIPropertyUniqueID, &uid)
            present.insert(uid)
        }
        // Esquece fontes que sumiram, para reconectar quando o teclado voltar.
        connected.formIntersection(present)
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            var uid: MIDIUniqueID = 0
            MIDIObjectGetIntegerProperty(src, kMIDIPropertyUniqueID, &uid)
            if connected.contains(uid) { continue }
            if MIDIPortConnectSource(port, src, nil) == noErr {
                connected.insert(uid)
            }
        }
    }

    private func devices() -> [[String: Any]] {
        var out: [[String: Any]] = []
        for i in 0..<MIDIGetNumberOfSources() {
            let src = MIDIGetSource(i)
            var uid: MIDIUniqueID = 0
            MIDIObjectGetIntegerProperty(src, kMIDIPropertyUniqueID, &uid)
            var name: Unmanaged<CFString>?
            var label = "Teclado MIDI"
            if MIDIObjectGetStringProperty(src, kMIDIPropertyDisplayName, &name) == noErr, let n = name {
                label = n.takeRetainedValue() as String
            }
            out.append(["id": String(uid), "name": label])
        }
        return out
    }

    // MARK: - Mensagens (Universal MIDI Packets)

    private static func wordsFor(type: UInt32) -> Int {
        switch type {
        case 0, 1, 2, 6, 7: return 1
        case 3, 4, 8, 9, 10: return 2
        case 11, 12: return 3
        default: return 4
        }
    }

    private func handle(_ list: UnsafePointer<MIDIEventList>) {
        var events: [[String: Any]] = []
        for packet in list.unsafeSequence() {
            let count = Int(packet.pointee.wordCount)
            withUnsafeBytes(of: packet.pointee.words) { raw in
                let words = raw.bindMemory(to: UInt32.self)
                var i = 0
                while i < count {
                    let w = words[i]
                    let type = w >> 28
                    let size = MidiPlugin.wordsFor(type: type)
                    if type == 2 {
                        // MIDI 1.0 de canal: 0x2g SS NN VV
                        let status = (w >> 16) & 0xF0
                        let note = Int((w >> 8) & 0x7F)
                        let vel = Int(w & 0x7F)
                        if status == 0x90 && vel > 0 {
                            events.append(["type": "on", "midi": note, "velocity": Double(vel) / 127.0])
                        } else if status == 0x80 || (status == 0x90 && vel == 0) {
                            events.append(["type": "off", "midi": note, "velocity": 0])
                        } else if status == 0xB0 && note == 64 {
                            // Pedal de sustain (CC64): vai como "nota" 128 para manter a API igual
                            events.append(["type": vel >= 64 ? "on" : "off", "midi": 128, "velocity": vel >= 64 ? 1.0 : 0])
                        }
                    } else if type == 4 && i + 1 < count {
                        // MIDI 2.0 de canal: velocidade de 16 bits na segunda palavra
                        let status = (w >> 16) & 0xF0
                        let note = Int((w >> 8) & 0x7F)
                        let vel16 = Int(words[i + 1] >> 16)
                        if status == 0x90 && vel16 > 0 {
                            events.append(["type": "on", "midi": note, "velocity": Double(vel16) / 65535.0])
                        } else if status == 0x80 || (status == 0x90 && vel16 == 0) {
                            events.append(["type": "off", "midi": note, "velocity": 0])
                        } else if status == 0xB0 && note == 64 {
                            let on = words[i + 1] >= 0x80000000
                            events.append(["type": on ? "on" : "off", "midi": 128, "velocity": on ? 1.0 : 0])
                        }
                    }
                    i += size
                }
            }
        }
        guard !events.isEmpty else { return }
        DispatchQueue.main.async {
            for e in events { self.notifyListeners("note", data: e) }
        }
    }
}

/// Backup em uma pasta escolhida pelo usuário (ex.: iCloud Drive).
/// O usuário escolhe a pasta uma vez; guardamos um "bookmark" para voltar a ela sem perguntar de novo.
@objc(CloudBackupPlugin)
public class CloudBackupPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "CloudBackupPlugin"
    public let jsName = "Backup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    ]

    private let bookmarkKey = "piano-estudio.backupFolder"
    private let fileName = "piano-estudio-backup.json"
    private var pendingCall: CAPPluginCall?

    private func folderURL() -> URL? {
        guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else { return nil }
        var stale = false
        guard let url = try? URL(resolvingBookmarkData: data, bookmarkDataIsStale: &stale) else { return nil }
        if stale, url.startAccessingSecurityScopedResource() {
            if let fresh = try? url.bookmarkData() { UserDefaults.standard.set(fresh, forKey: bookmarkKey) }
            url.stopAccessingSecurityScopedResource()
        }
        return url
    }

    @objc func pickFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.pendingCall = call
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        guard let url = urls.first else { call.reject("Nenhuma pasta escolhida"); return }
        let ok = url.startAccessingSecurityScopedResource()
        defer { if ok { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try url.bookmarkData()
            UserDefaults.standard.set(data, forKey: bookmarkKey)
            call.resolve(["name": url.lastPathComponent])
        } catch {
            call.reject("Não consegui guardar a pasta: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingCall?.resolve(["cancelled": true])
        pendingCall = nil
    }

    @objc func status(_ call: CAPPluginCall) {
        if let url = folderURL() {
            call.resolve(["configured": true, "folderName": url.lastPathComponent])
        } else {
            call.resolve(["configured": false])
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let text = call.getString("data") else { call.reject("Sem dados"); return }
        guard let folder = folderURL() else { call.reject("Pasta de backup não escolhida"); return }
        DispatchQueue.global(qos: .utility).async {
            let ok = folder.startAccessingSecurityScopedResource()
            defer { if ok { folder.stopAccessingSecurityScopedResource() } }
            let target = folder.appendingPathComponent(self.fileName)
            var coordError: NSError?
            var writeError: Error?
            NSFileCoordinator().coordinate(writingItemAt: target, options: .forReplacing, error: &coordError) { url in
                do { try Data(text.utf8).write(to: url, options: .atomic) } catch { writeError = error }
            }
            if let e = coordError ?? (writeError as NSError?) {
                call.reject("Falha ao salvar backup: \(e.localizedDescription)")
            } else {
                call.resolve(["savedAt": ISO8601DateFormatter().string(from: Date())])
            }
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard let folder = folderURL() else { call.reject("Pasta de backup não escolhida"); return }
        DispatchQueue.global(qos: .utility).async {
            let ok = folder.startAccessingSecurityScopedResource()
            defer { if ok { folder.stopAccessingSecurityScopedResource() } }
            let target = folder.appendingPathComponent(self.fileName)
            // Se o arquivo ainda está só na nuvem, pede para baixar.
            try? FileManager.default.startDownloadingUbiquitousItem(at: target)
            var coordError: NSError?
            var result: String?
            NSFileCoordinator().coordinate(readingItemAt: target, options: [], error: &coordError) { url in
                result = try? String(contentsOf: url, encoding: .utf8)
            }
            if let r = result { call.resolve(["data": r]) } else { call.resolve([:]) }
        }
    }
}

/// Registra o plugin de MIDI na ponte do Capacitor.
/// Também esconde a barra de status (hora, Wi-Fi, bateria) para o app ocupar a tela toda.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MidiPlugin())
        bridge?.registerPluginInstance(CloudBackupPlugin())
    }

    override var prefersStatusBarHidden: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        setNeedsStatusBarAppearanceUpdate()
    }
}
