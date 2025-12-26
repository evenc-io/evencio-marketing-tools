import { describe, expect, it } from "bun:test"
import { zodResolver } from "@hookform/resolvers/zod"
import { fireEvent, render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"

const schema = z.object({
	name: z.string().min(1, "Required"),
})

type Values = z.infer<typeof schema>

const TestForm = () => {
	const form = useForm<Values>({
		resolver: zodResolver(schema),
		mode: "onChange",
		defaultValues: { name: "" },
	})

	return (
		<Form {...form}>
			<form>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<input {...field} aria-label="Name" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</form>
		</Form>
	)
}

describe("Form components", () => {
	it("renders validation errors and aria-invalid", async () => {
		render(<TestForm />)

		const input = screen.getByLabelText("Name")
		fireEvent.change(input, { target: { value: "Ok" } })
		fireEvent.change(input, { target: { value: "" } })
		fireEvent.blur(input)

		expect(await screen.findByText("Required")).toBeInTheDocument()
		expect(input).toHaveAttribute("aria-invalid", "true")
	})
})
