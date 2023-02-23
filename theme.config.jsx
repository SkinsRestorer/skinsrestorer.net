import Image from "next/image";

export default {
    logo: <div style={{display: "flex", alignItems: "center", gap: "4px"}}>
        <Image src={"/logo.png"} width={32} height={32}/>
        <span>SkinsRestorer</span>
    </div>,
    project: {
        link: 'https://github.com/SkinsRestorer/SkinsRestorerX',
    },
    // ...
}
