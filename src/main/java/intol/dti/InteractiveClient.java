package intol.dti;

import java.io.Console;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class InteractiveClient {

        public static void main(String[] args) throws IOException {
        int clientId = (args.length > 0) ? Integer.parseInt(args[0]) : 1001;
        DTI<Integer, String> dti = new DTI<>(clientId);

        Console console = System.console();

        System.out.println("\nCommands:\n");
        System.out.println("\tCOINS: get the IDs and values of your coins");
        System.out.println("\tMINT: Create a coin with a certain value");
        System.out.println("\tSPEND: Send your coins to another user");

        while (true) {
            String cmd = console.readLine("\n  > ");

            if(cmd.equalsIgnoreCase("COINS")) {
                //invokes the op on the servers
                Map<Integer,String> coins = dti.getCoins();
                if(coins == null) {
                    System.out.println("\nYou have no coins");
                    continue;
                }
                int totalValue = 0;
                for (Map.Entry<Integer,String> entry : coins.entrySet()) {
                    Integer key = entry.getKey();
                    String valueStr = entry.getValue();
                    try {
                        Float value = Float.parseFloat(valueStr);
                        totalValue += value;
                        System.out.println("\nValue associated with " + key + ": " + value);
                    } catch (NumberFormatException e) {
                        System.out.println("\nInvalid value format for key " + key + ": " + valueStr + "\n");
                    }
                }
                System.out.println("\nTotal value is: " + totalValue);
            } else if(cmd.equalsIgnoreCase("MINT")) {
                Float value;
                try {
                    value = Float.parseFloat(console.readLine("Enter a numeric value: "));
                } catch (NumberFormatException e) {
                    System.out.println("\tThe value is supposed to be a number!\n");
                    continue;
                }

                //invokes the op on the servers
                Integer coinId = dti.mint(value);

                System.out.println("\nCoin created with ID: " + coinId + " with value: " + value);
            } else if(cmd.equalsIgnoreCase("SPEND")) {
                int value;
                int receiverId;
                List<Integer> coins;
                try {
                    // Get the numeric value to spend.
                    value = Integer.parseInt(console.readLine("Enter a numeric value to spend: "));
                    // Get the receiver's ID.
                    receiverId = Integer.parseInt(console.readLine("Enter the ID of the receiver: "));
                    // Get a comma-separated list of coin IDs to use.
                    String coinInput = console.readLine("Enter the coin IDs to use (comma separated): ");
                    
                    // Initialize the list and parse the input.
                    coins = new ArrayList<>();
                    String[] coinIds = coinInput.split(",");
                    for(String coinStr : coinIds) {
                        coins.add(Integer.parseInt(coinStr.trim()));
                    }
                } catch (NumberFormatException e) {
                    System.out.println("\tThe value is supposed to be a number!\n");
                    continue;
                }

                Integer coinId = dti.spend(coins, receiverId, value);
                System.out.println("\nThe coin ID with the remaining value is: " + coinId);
            }
        }

    }
}
