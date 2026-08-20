export default function Loading() {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#171717] text-white">
            <div className="mb-5 grid h-14 w-14 place-items-center bg-[#cc0000]">
                <div className="h-6 w-6 animate-spin border-2 border-white/35 border-t-white" />
            </div>
            <div className="text-xl font-black uppercase tracking-[-0.03em]">
                Flow<span className="text-[#ef2b2d]">NJIT</span>
            </div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                Mapping course pathways
            </p>
        </div>
    );
}
